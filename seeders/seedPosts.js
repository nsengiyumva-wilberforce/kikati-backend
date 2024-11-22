const mongoose = require("mongoose");
const { faker } = require('@faker-js/faker'); // Correct import for the faker library
const Post = require("../models/Post");
const User = require("../models/User");

const seedPosts = async () => {
  try {
    // Connect to your MongoDB database
    await mongoose
      .connect('mongodb://localhost:27017/ki_kati')
      .then(() => console.log("MongoDB connected"))
      .catch((err) => console.log(err));

    // Find all users to associate as authors
    const users = await User.find();

    if (users.length === 0) {
      console.log("No users found to associate with posts.");
      return;
    }

    // Create an array to store the posts
    let posts = [];

    // Generate 1000 posts
    for (let i = 0; i < 1000; i++) {
      // Random content for the post
      const content = faker.lorem.paragraphs(2); // faker.lorem.paragraphs works with @faker-js/faker

      // Random media for each post (optional)
      const media = [];
      const numberOfMedia = faker.number.int({ min: 0, max: 3 }); // Updated to use faker.number.int
      for (let j = 0; j < numberOfMedia; j++) {
        media.push({
          url: `/uploads/${faker.system.fileName()}`, // Simulate a media URL
          type: faker.helpers.arrayElement(["image", "video", "file"]), // Randomly choose the type of media
          filename: faker.system.fileName(),
        });
      }

      // Randomly select an author
      const randomUser = users[faker.number.int({ min: 0, max: users.length - 1 })]; // Updated to use faker.number.int

      // Create the post object
      const post = new Post({
        author: randomUser._id, // Assuming your User model has an _id field
        content,
        media,
        likes: [], // Start with no likes
        comments: [], // Start with no comments
        createdAt: faker.date.past(), // Random creation date
        updatedAt: new Date(),
      });

      posts.push(post);
    }

    // Insert all posts at once
    await Post.insertMany(posts);
    console.log("1000 posts have been seeded!");
  } catch (error) {
    console.error("Error seeding posts:", error);
  } finally {
    // Close the database connection
    mongoose.connection.close();
  }
};

seedPosts();
