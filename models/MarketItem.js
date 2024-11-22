const mongoose = require("mongoose");

const marketItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      minlength: [3, "Title must be at least 3 characters long"], // Ensuring a minimum length
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      minlength: [10, "Description must be at least 10 characters long"], // Enforcing minimum length
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0.1, "Price must be greater than 0"], // Ensuring price is positive
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      enum: [
        "Electronics",
        "Clothing",
        "Food",
        "Services",
        "Furniture",
        "Other",
      ],
      required: [true, "Category is required"],
    },
    location: {
      city: {
        type: String,
        required: [true, "City is required"], // Ensuring city is provided
      },
      region: {
        type: String,
        required: [true, "Region is required"], // Ensuring region is provided
      },
    },
    images: [{ type: String }], // Array of image paths (not URLs)
    quantity: {
      type: Number,
      default: 1,
      min: [1, "Quantity must be at least 1"], // Ensuring quantity is greater than 0
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Model creation
const MarketItem = mongoose.model("MarketItem", marketItemSchema);

module.exports = MarketItem;
