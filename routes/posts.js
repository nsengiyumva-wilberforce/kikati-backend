const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth"); // Your auth middleware
const emailVerified = require("../middleware/email-verified"); // Your email verification middleware
const Post = require("../models/Post");

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads"); // The folder to save the file
  },
  filename: function (req, file, cb) {
    // Extract file extension from mimetype
    const ext = file.mimetype.split("/")[1]; // Extract the file extension (e.g., 'png', 'jpeg')

    // Create a unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);

    // Save the file with its proper extension
    cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
  },
});

const upload = multer({ storage }); // Specify the upload directory

module.exports = (io, activeUsers) => {
  // Create a new post
  router.post(
    "/create",
    auth,
    emailVerified,
    upload.array("media"),
    async (req, res) => {
      const { content } = req.body;
      try {
        const mediaFiles = req.files
          ? req.files.map((file) => ({
              url: `/uploads/${file.filename}`, // Assuming you're serving files from the 'uploads' directory
              type: file.mimetype.startsWith("image/")
                ? "image"
                : file.mimetype.startsWith("video/")
                ? "video"
                : "file",
              filename: file.originalname,
            }))
          : [];

        const post = new Post({
          author: req.user.id,
          content,
          media: mediaFiles, // Attach media files if any
        });

        await post.save();

        // Emit the new post to all connected users
        io.emit("newPost", {
          author: req.user.id,
          content,
          media: mediaFiles,
        });

        res.status(201).json({ message: "Post created successfully", post });
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
      }
    }
  );

  // Get all posts (with pagination)
  router.get("/", auth, emailVerified, async (req, res) => {
    const { page = 1, limit = 10 } = req.query; // Pagination query params

    try {
      const posts = await Post.find()
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("author", "username firstName lastName") // Populate author details
        .sort({ createdAt: -1 }); // Sort by creation date (newest first)

      res.status(200).json(posts);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get a specific post by ID
  router.get("/:postId", auth, emailVerified, async (req, res) => {
    const { postId } = req.params;

    try {
      const post = await Post.findById(postId)
        .populate("author", "username firstName lastName")
        .populate("comments.user", "username");

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      res.status(200).json(post);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  router.put(
    "/:postId",
    auth,
    emailVerified,
    upload.array("media"),
    async (req, res) => {
      const { postId } = req.params;
      const { content } = req.body;

      try {
        const post = await Post.findById(postId);

        if (!post) {
          return res.status(404).json({ message: "Post not found" });
        }

        // Check if the logged-in user is the author of the post
        if (post.author.toString() !== req.user.id) {
          return res
            .status(403)
            .json({ message: "Not authorized to edit this post" });
        }

        // Update post content
        post.content = content;

        // Handle media update (replace existing media or add new media)
        const mediaFiles = req.files
          ? req.files.map((file) => ({
              url: `/uploads/${file.filename}`,
              type: file.mimetype.startsWith("image/")
                ? "image"
                : file.mimetype.startsWith("video/")
                ? "video"
                : "file",
              filename: file.originalname,
            }))
          : [];

        // If media files were uploaded, update the media array
        if (mediaFiles.length > 0) {
          post.media = mediaFiles; // This replaces the old media with the new media
        }

        // Update the updatedAt field
        post.updatedAt = new Date();

        // Save the updated post
        await post.save();

        res.status(200).json({ message: "Post updated", post });
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
      }
    }
  );

  // Delete a post (only by the author)
  router.delete("/:postId", auth, emailVerified, async (req, res) => {
    const { postId } = req.params;

    try {
      const post = await Post.findById(postId);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (post.author.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ message: "Not authorized to delete this post" });
      }

      await Post.findByIdAndDelete(postId); // Using findByIdAndDelete
      res.status(200).json({ message: "Post deleted successfully" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Like a post
  router.post("/:postId/like", auth, emailVerified, async (req, res) => {
    const { postId } = req.params;

    try {
      const post = await Post.findById(postId);

      if (post.likes.includes(req.user.id)) {
        return res.status(400).json({ message: "You already liked this post" });
      }

      post.likes.push(req.user.id);
      await post.save();

      res.status(200).json({ message: "Post liked", post });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Unlike a post
  router.post("/:postId/unlike", auth, emailVerified, async (req, res) => {
    const { postId } = req.params;

    try {
      const post = await Post.findById(postId);

      if (!post.likes.includes(req.user.id)) {
        return res.status(400).json({ message: "You haven't liked this post" });
      }

      post.likes.pull(req.user.id);
      await post.save();

      res.status(200).json({ message: "Post unliked", post });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Add a comment to a post
  router.post("/:postId/comment", auth, emailVerified, async (req, res) => {
    const { postId } = req.params;
    const { content } = req.body;

    try {
      const post = await Post.findById(postId);

      const comment = {
        user: req.user.id,
        content,
        createdAt: new Date(),
      };

      post.comments.push(comment);
      await post.save();

      res.status(201).json({ message: "Comment added", comment });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get all comments for a post
  router.get("/:postId/comments", auth, emailVerified, async (req, res) => {
    const { postId } = req.params;

    try {
      const post = await Post.findById(postId).populate(
        "comments.user",
        "username"
      );

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      res.status(200).json(post.comments);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Add a reply to a comment
  router.post(
    "/:postId/comment/:commentId/reply",
    auth,
    emailVerified,
    async (req, res) => {
      const { postId, commentId } = req.params;
      const { content } = req.body;

      try {
        const post = await Post.findById(postId);
        if (!post) {
          return res.status(404).json({ message: "Post not found" });
        }

        // Find the comment to which the user wants to reply
        const comment = post.comments.id(commentId);
        if (!comment) {
          return res.status(404).json({ message: "Comment not found" });
        }

        // Add the reply to the comment's replies array
        comment.replies.push({
          user: req.user.id,
          content,
          createdAt: new Date(),
        });

        // Save the post with the new reply
        await post.save();

        res.status(201).json({
          message: "Reply added",
          reply: comment.replies[comment.replies.length - 1],
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
      }
    }
  );

  return router; // Return the router
};
