const express = require("express");
const auth = require("../middleware/auth"); // Your auth middleware
const emailVerified = require("../middleware/email-verified"); // Your email verification middleware
const MarketItem = require("../models/MarketItem");
const User = require("../models/User");
const multer = require("multer");

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

module.exports = (io) => {
  // Create a new market item (with image upload)
  router.post(
    "/create",
    auth,
    emailVerified,
    upload.array("media", 5),
    async (req, res) => {
      const { title, description, price, category, location, quantity } =
        req.body;

      // Handle image files
      const media = req.files ? req.files.map((file) => file.path) : [];

      try {
        const newItem = new MarketItem({
          title,
          description,
          price,
          category,
          location,
          media,
          quantity,
          seller: req.user.id, // The authenticated user is the seller
        });

        // This will trigger Mongoose's built-in validation
        await newItem.save();

        // Add the item to the seller's user record (optional)
        await User.findByIdAndUpdate(req.user._id, {
          $push: { marketItems: newItem._id },
        });

        res
          .status(201)
          .json({ message: "Item listed successfully", item: newItem });
      } catch (error) {
        if (error.name === "ValidationError") {
          // Handle validation errors with detailed messages
          const validationErrors = Object.values(error.errors).map(
            (err) => err.message
          );
          return res.status(400).json({
            message: "Validation error",
            errors: validationErrors,
          });
        }
        console.log(error);
        res
          .status(500)
          .json({ message: "Server error, please try again later." });
      }
    }
  );

  // Optional: Get all market items with pagination, filters, and search
  router.get("/", auth, emailVerified, async (req, res) => {
    const {
      page = 1,
      limit = 10,
      category,
      city,
      priceRange,
      searchQuery,
    } = req.query;

    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (city) {
      filter["location.city"] = city;
    }

    if (priceRange) {
      const [minPrice, maxPrice] = priceRange.split("-");
      if (!minPrice || !maxPrice) {
        return res.status(400).json({ message: "Invalid price range format." });
      }
      filter.price = { $gte: minPrice, $lte: maxPrice };
    }

    if (searchQuery) {
      const searchRegex = new RegExp(searchQuery, "i");
      filter.$or = [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
      ];
    }

    try {
      const items = await MarketItem.find(filter)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("seller", "username")
        .sort({ createdAt: -1 });

      res.status(200).json(items);
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "Server error, please try again later." });
    }
  });

  // Example for fetching an item with images
  router.get("/:id", auth, emailVerified, async (req, res) => {
    try {
      const item = await MarketItem.findById(req.params.id).populate(
        "seller",
        "username"
      );

      if (!item) {
        return res.status(404).json({ message: "Item not found." });
      }

      res.status(200).json(item);
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "Server error, please try again later." });
    }
  });

  // Update a market item (only the seller can update their item)
  router.put("/:id", auth, emailVerified, async (req, res) => {
    try {
      const item = await MarketItem.findById(req.params.id);

      if (!item) {
        return res.status(404).json({ message: "Item not found." });
      }

      if (item.seller.toString() !== req.user.id.toString()) {
        return res
          .status(403)
          .json({ message: "You are not the seller of this item." });
      }

      const updatedItem = await MarketItem.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedAt: Date.now() },
        { new: true }
      );

      res
        .status(200)
        .json({ message: "Item updated successfully", item: updatedItem });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "Server error, please try again later." });
    }
  });

  // Delete a market item (only the seller can delete their item)
  router.delete("/:id", auth, emailVerified, async (req, res) => {
    try {
      const item = await MarketItem.findById(req.params.id);

      if (!item) {
        return res.status(404).json({ message: "Item not found." });
      }

      if (item.seller.toString() !== req.user.id.toString()) {
        return res
          .status(403)
          .json({ message: "You are not the seller of this item." });
      }

      await MarketItem.findByIdAndDelete(req.params.id);
      res.status(200).json({ message: "Item deleted successfully." });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "Server error, please try again later." });
    }
  });

  // Optional: Get all items listed by a specific user
  router.get("/user/:userId", auth, emailVerified, async (req, res) => {
    try {
      console.log(req.params.userId);
      const items = await MarketItem.find({ seller: req.params.userId })
        .populate("seller", "username")
        .sort({ createdAt: -1 }); // Sort by creation date

      res.status(200).json(items);
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "Server error, please try again later." });
    }
  });

  // Socket.io for broadcasting updates when a new item is listed
  io.on("connection", (socket) => {
    console.log("Client connected to socket");

    // When a new item is created, broadcast the event to all connected clients
    socket.on("newItem", (item) => {
      console.log(`New item listed: ${item.title}`);
      io.emit("itemListed", item); // Broadcast the new item to all clients
    });

    // Handle socket disconnects
    socket.on("disconnect", () => {
      console.log("A client disconnected");
    });
  });

  return router;
};
