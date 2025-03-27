const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address=require("../../models/addressSchema")
const Category = require("../../models/categorySchema")
const { ObjectId } = require('mongodb');  // Ensure ObjectId is imported
const mongoose = require('mongoose');

const removeBlockedOrUnlistedItems = async (user) => {
  const updatedCart = [];
  for (const item of user.cart) {
    const product = await Product.findById(item.productId).populate('category');
    if (product && product.isActive && product.category.isListed) {
      updatedCart.push(item);
    }
  }
  user.cart = updatedCart;
  await user.save();
};


const getCartPage = async (req, res) => {
  try {
    const user = req.session.user; // Entire user object
    console.log("User object from session:", user);

    if (!user || !user._id) {
      console.error("User ID not found in session");
      return res.status(400).send("User not logged in");
    }

    const userId = user._id.toString(); // Extract and convert _id to string
    console.log("Extracted User ID:", userId);

    if (!ObjectId.isValid(userId)) {
      console.error("Invalid userId:", userId);
      return res.status(400).send("Invalid User ID");
    }

    const cart = await Cart.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $lookup: {
          from: "categories",
          localField: "productDetails.category",
          foreignField: "_id",
          as: "categoryDetails"
        }
      },
      { $unwind: "$categoryDetails" },
      {
        $match: {
          "productDetails.isBlocked": { $ne: true },
          "categoryDetails.isListed": { $eq: true }
        }
      },
      {
        $project: {
          _id: 0,
          product: "$productDetails",
          quantity: "$items.quantity",
          totalPrice: { $multiply: ["$items.quantity", "$productDetails.salePrice"] }
        }
      },
      {
        $group: {
          _id: null,
          cartItems: { $push: { product: "$product", quantity: "$quantity", totalPrice: "$totalPrice" } },
          grandTotal: { $sum: "$totalPrice" }
        }
      }
    ]);

    console.log("Aggregated cart data:", cart);

    if (!cart || cart.length === 0 || !cart[0].cartItems || cart[0].cartItems.length === 0) {
      console.log("Cart is empty");
      return res.render("cart", {
        cartItems: [],
        subtotal: 0,
        shipping: 100,
        grandTotal: 100,
        user: req.session.user
      });
    }

const { cartItems, grandTotal } = cart[0];

    const subtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
    const shipping = subtotal >= 5000 ? 0 : 100;

    res.render("cart", {
      cartItems,
      subtotal,
      shipping,
      grandTotal: subtotal + shipping,
      user: req.session.user
    });

  } catch (error) {
    console.error("Error in getCartPage:", error);
    res.status(500).send("An error occurred while loading the cart");
  }
};




const addToCart = async (req, res) => {
  try {
      const userId = req.session.user;
      if (!userId) return res.status(401).json({ success: false, message: "Please log in to add items to the cart" });

      const productId = req.query.id;
      const quantity = parseInt(req.query.quantity) || 1;
      const product = await Product.findById(productId); // check for valid product (rare case if not present then it will not show in UI)
      if (!product) return res.status(404).json({ success: false, message: "Product not found" });

      let cart = await Cart.findOne({ userId }); // check if the user already has a cart

      if (!cart) {
          cart = new Cart({ userId, items: [] }); // if not present, create a new cart
      }

      const itemIndex = cart.items.findIndex((item) => item.productId.equals(productId));
      const productPrice = Number(product.salePrice) || 0;

      // Assuming shipping cost is a fixed value or dynamically calculated.
      const shippingCost = 10; // Use a fixed value or calculate dynamically based on certain factors

      if (itemIndex > -1) {  // Item is already in the cart, just update the quantity
          cart.items[itemIndex].quantity += quantity;
          cart.items[itemIndex].totalPrice = cart.items[itemIndex].quantity * cart.items[itemIndex].price + shippingCost;
      } else {
          // New item, add it to the cart
          cart.items.push({
              productId,
              quantity: quantity,
              price: productPrice,
              totalPrice: quantity * productPrice + shippingCost,
              shipping: shippingCost, // Use numeric shipping value
              status: "placed",
              cancellationReason: "none"
          });
      }

      // Recalculate cart's total price if needed
      cart.cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

      await cart.save();

      res.json({ success: true, message: "Product added to cart" });

  } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


const loadCheckoutPage = async (req, res) => {
  try {
    
    const userId = req.session.user;

    // Ensure userId exists before proceeding
    if (!userId) {
      return res.status(400).send('User not logged in');
    }

    console.log("User ID from session:", userId);  // Debugging the user ID

    // Aggregation pipeline for Cart
    const cart = await Cart.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId._id) // Match by userId
        }
      },
      {
        $unwind: "$items"  // Unwind the `items` array so each item is treated individually
      },
      {
        $lookup: {
          from: "products",  // Join with the `products` collection
          localField: "items.productId",  // Match the `items.productId` with the `products._id`
          foreignField: "_id",  // Match `productId` in items with the `_id` of products
          as: "productDetails"  // Store the result in `productDetails`
        }
      },
      {
        $unwind: {
          path: "$productDetails",  // Unwind the `productDetails` array
          preserveNullAndEmptyArrays: true  // Don't exclude the document if no matching product is found
        }
      },
      {
        $lookup: {
          from: "categories",  // Join with the `categories` collection
          localField: "productDetails.category",  // Match `productDetails.category` with `categories._id`
          foreignField: "_id",  // Match the category with the `_id` in categories collection
          as: "categoryDetails"  // Store the result in `categoryDetails`
        }
      },
      {
        $unwind: {
          path: "$categoryDetails",  // Unwind the `categoryDetails` array
          preserveNullAndEmptyArrays: true  // Don't exclude the document if no matching category is found
        }
      },
      {
        $match: {
          "productDetails.isBlocked": { $ne: true },  // Filter out blocked products
          "categoryDetails.isListed": { $eq: true }   // Filter out unlisted categories
        }
      },
      {
        $project: {
          _id: 0,
          product: "$productDetails",  // Include the product details
          quantity: "$items.quantity",  // Corrected reference to quantity
          totalPrice: {
            $multiply: ["$items.quantity", "$productDetails.salePrice"]  // Corrected reference to quantity
          }
        }
      },
      {
        $group: {
          _id: null,  // Group all the results into one document
          cartItems: { 
            $push: {  // Push each cart item into an array
              product: "$product", 
              quantity: "$quantity", 
              totalPrice: "$totalPrice"
            } 
          },
          grandTotal: { $sum: "$totalPrice" }  // Calculate the grand total
        }
      }
    ])
    console.log("aggrigate is working")

    // If no cart found or the cartItems array is empty, handle it gracefully
    if (!cart || cart.length === 0 || !cart[0].cartItems || cart[0].cartItems.length === 0) {
      console.log("Cart is empty or not found");
      return res.redirect("/empty-cart");  // Redirect to a page that handles the empty cart situation
    }

    const { cartItems, grandTotal } = cart[0];

    // Calculate the subtotal (sum of totalPrice of all items)
    const subtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);

    // Define shipping cost: free shipping for orders over ₹5000, ₹100 for orders below
    const shipping = subtotal >= 5000 ? 0 : 100;

    // Get address data
    const addressData = await Address.findOne({ userId: userId });

    // If address is not found, you could handle this case too
    if (!addressData) {
      return res.status(400).send("Address not found");
    }


    // Render the checkout page with the populated cart items, subtotal, shipping, and grand total
    res.render("checkout", {
      user: userId,  // Pass userId or full user data if required
      cartItems,
      subtotal,      // Pass subtotal to the view
      shipping,      // Pass shipping to the view
      grandTotal,
      userAddress: addressData,  // Pass user address
    
    });
  } catch (error) {
    console.error('Error in loadCheckoutPage:', error);
    res.redirect("/pageNotFound");
  }
};




const changeQuantity = async (req, res) => {
  try {
    const { productId, action } = req.body;
    const userId = req.session.user;

    const user = await User.findById(userId);
    const product = await Product.findById(productId);

    if (!user || !product) {
      return res.status(404).json({ status: false, message: "User or Product not found" });
    }

    const cartItemIndex = user.cart.findIndex(item => item.productId.toString() === productId);

    if (cartItemIndex === -1) {
      return res.status(404).json({ status: false, message: "Product not found in cart" });
    }

    let newQuantity = user.cart[cartItemIndex].quantity;

    if (action === 'increase') {
      if (newQuantity >= product.quantity) {
        return res.status(400).json({ status: false, message: "Cannot add more, product is out of stock" });
      }
      newQuantity += 1;
    } else if (action === 'decrease') {
      if (newQuantity > 1) {
        newQuantity -= 1;
      } else {
        // Remove item if quantity becomes 0
        user.cart.splice(cartItemIndex, 1);
        await user.save();
        return res.json({ status: true, message: "Product removed from cart", quantity: 0 });
      }
    } else {
      return res.status(400).json({ status: false, message: "Invalid action" });
    }

    user.cart[cartItemIndex].quantity = newQuantity;
    await user.save();

    // Recalculate cart total
    const updatedUser = await User.findById(userId).populate({
      path: 'cart.productId',
      model: 'Product'
    });
    const grandTotal = updatedUser.cart.reduce((total, item) => total + (item.productId.salePrice * item.quantity), 0);

    return res.json({ 
      status: true, 
      message: "Cart updated", 
      quantity: newQuantity, 
      grandTotal: grandTotal 
    });
  } catch (error) {
    console.error('Error in changeQuantity:', error);
    return res.status(500).json({ status: false, message: "An error occurred while updating the cart" });
  }
};


const removeCartItem = async (req, res) => {
  try {
    const userId = req.session.user
    const { productId } = req.body
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }
    const cart = await Cart.findOne({ userId })
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' })
    }
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId
    )
    await cart.save()
    return res.json({ success: true })
  } catch (error) {
    console.error('Error removing item from cart:', error)
    return res.status(500).json({ success: false, message: 'Failed to remove item' })
  }
}

module.exports = {
  getCartPage,
  addToCart,
  changeQuantity,
  removeCartItem,
  loadCheckoutPage
};