const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Address=require("../../models/addressSchema")
const Coupon=require("../../models/couponSchema")
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
    const user = req.session.user;

    if (!user || !user._id) {
      console.error("User ID not found in session");
      return res.status(400).send("User not logged in");
    }

    const userId = user._id.toString();
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
          product: {
            $mergeObjects: [
              "$productDetails",
              {
                category: {
                  $mergeObjects: [
                    "$categoryDetails",
                    { offer: "$categoryDetails.offer" }
                  ]
                }
              }
            ]
          },
       
          quantity: "$items.quantity",
          totalPrice: { $multiply: ["$items.quantity", "$productDetails.salePrice"] }
        }
      },
      {
        $group: {
          _id: null,
          cartItems: {
            $push: {
              product: "$product",
              quantity: "$quantity",
              totalPrice: "$totalPrice"
            }
          },
          grandTotal: { $sum: "$totalPrice" }
        }
      }
    ]);

    // Empty cart case
    if (!cart || cart.length === 0 || !cart[0].cartItems || cart[0].cartItems.length === 0) {
      return res.render("cart", {
        cartItems: [],
        subtotal: 0,
        shipping: 0,
        preSubtotal: 0,
        grandTotal: 0,
        user: req.session.user
      });
    }

    // When items exist
    const { cartItems } = cart[0];

    let preSubtotal = cartItems.reduce((acc, item) => {
   
      return acc + Math.floor(item.product.salePrice * item.quantity);
    }, 0);

    const shipping = preSubtotal >= 5000 ? 0 : 100;
    const subtotal = preSubtotal + shipping;

    res.render("cart", {
      cartItems,
      subtotal,
      shipping,
      preSubtotal,
      grandTotal: subtotal,
      user: req.session.user
    });

  } catch (error) {
    console.error("Error in getCartPage:", error);
    res.render("cartdup"); // Optional: show error page
  }
};



const addToCart = async (req, res) => {
  try {
      const userId = req.session.user;
      if (!userId) {
          return res.status(401).json({ success: false, message: "Please log in to add items to the cart" });
      }

      const productId = req.query.id;
      const quantity = parseInt(req.query.quantity) || 1;
      const product = await Product.findById(productId); // Fetch the product

      if (!product) {
          return res.status(404).json({ success: false, message: "Product not found" });
      }

      // Check if the product is available
      if (product.quantity <= 0 || product.status === 'out of stock' || product.status === 'discontinued') {
          return res.status(400).json({ success: false, message: "Product is not available" });
      }

      if (product.quantity < quantity) {
        return res.status(400).json({ success: false, message:"no items" });
    }

      let cart = await Cart.findOne({ userId }); // Find existing cart for user

      if (!cart) {
          cart = new Cart({ userId, items: [] }); // Create new cart if none exists
      }

      const itemIndex = cart.items.findIndex((item) => item.productId.equals(productId));
      const productPrice = Number(product.salePrice) || 0;

      // Assuming shipping cost is a fixed value or dynamically calculated
      const shippingCost = 10; // You can adjust this or make it dynamic

      if (itemIndex > -1) { // If the item is already in the cart, update quantity
          cart.items[itemIndex].quantity += quantity;
          cart.items[itemIndex].totalPrice = cart.items[itemIndex].quantity * cart.items[itemIndex].price + shippingCost;
      } else { // If it's a new item, add it to the cart
          if (product.quantity > 0) {
              cart.items.push({
                  productId,
                  quantity,
                  price: productPrice,
                  totalPrice: quantity * productPrice + shippingCost,
                  shipping: shippingCost, // Numeric shipping value
                  status: "placed",
                  cancellationReason: "none"
              });
          } else {
              return res.status(404).send("Product is out of stock");
          }
      }

      // Recalculate total cart price
      cart.cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

      let currentCartQuantity = cart.items.find(item => item.productId == productId)?.quantity || 0;
      if (currentCartQuantity  > product.quantity) {
        return res.render('page-404')
      }
      // Save the product's updated stock
      await product.save();

      await cart.save(); // Save the updated cart

      res.json({ success: true, message: "Product added to cart" });

  } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};



const updateCartItem = async (req, res) => {
  const { productId, quantity } = req.body;

  // Assuming you have a Cart model and user is logged in
  const userId = req.session.user._id;  // Get the user ID (assuming you're using sessions or JWT)
  console.log("user id session = ", userId);
  console.log("product id = ", productId);

  try {
      // Find the cart for the user and update the quantity
      const updatedCart = await Cart.findOneAndUpdate(
          { userId: userId, "items.productId": productId },  // Find the cart item
          { $set: { "items.$.quantity": quantity } },       // Update the quantity
          { new: true }  // Return the updated document
      );

      // Check if the cart was updated
      if (!updatedCart) {
          return res.status(404).json({ success: false, message: 'Cart item not found.' });
      }

      // Send the updated cart back in the response
      res.json({ success: true, cart: updatedCart });
  } catch (err) {
      console.error("Error updating cart: ", err);
      res.status(500).json({ success: false, message: 'Failed to update cart.' });
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
          },
          categoryOffer: "$categoryDetails.categoryOffer"  // Include the category offer
        }
      },
      {
        $group: {
          _id: null,  // Group all the results into one document
          cartItems: { 
            $push: {  // Push each cart item into an array
              product: "$product", 
              quantity: "$quantity", 
              totalPrice: "$totalPrice",
              categoryOffer: "$categoryOffer"  // Include the category offer for each product
            } 
          },
          grandTotal: { $sum: "$totalPrice" }  // Calculate the grand total
        }
      }
    ]);

    console.log("Aggregation is working");

    // If no cart found or the cartItems array is empty, handle it gracefully
    if (!cart || cart.length === 0 || !cart[0].cartItems || cart[0].cartItems.length === 0) {
      console.log("Cart is empty or not found");
      return res.redirect("/empty-cart");  // Redirect to a page that handles the empty cart situation
    }

    const { cartItems, grandTotal } = cart[0];

    // Calculate the subtotal (sum of totalPrice of all items)
    let subtotal = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);

    // Apply category offer to the subtotal (if an offer exists)
    let preSubtotal = subtotal;
    // cartItems.forEach(item => {
    //   if (item.categoryOffer > 0) {
    //     preSubtotal -= (preSubtotal * item.categoryOffer) / 100;  // Apply discount percentage to the subtotal
    //   }
    // });

    // Define shipping cost: free shipping for orders over ₹5000, ₹100 for orders below
    const shipping = preSubtotal >= 5000 ? 0 : 100;
    subtotal = preSubtotal + shipping;  // Add shipping to the final subtotal

    // Get address data
    const addressData = await Address.findOne({ userId: userId });
const user=await User.findOne({_id:userId})
    // If address is not found, you could handle this case too
    if (!addressData) {
      user.address= {
        name: "John Doe",
        phone: "+1 9876543210",
        addressLine1: "123 Main Street",
        addressLine2: "Apt 4B",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
        isDefault: true
      };
      
    }

    const allCoupons = await Coupon.find({ isList: true });
    console.log("allCoupons = ", allCoupons);
    const coupon = await Coupon.find({});

    // Render the checkout page with the populated cart items, subtotal, shipping, and grand total
    res.render("checkout", {
      user: userId,  // Pass userId or full user data if required
      cartItems,
      subtotal,      // Pass subtotal to the view
      shipping,      // Pass shipping to the view
      grandTotal,
      preSubtotal,
      userAddress: addressData,  // Pass user address
      couponDetails: coupon,
      allCoupons: allCoupons,
    
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

const applyCoupon=async(req,res)=>{
  const { couponCode } = req.body;

  if (!couponCode) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
  }


  const coupon =await Coupon.findOne({name:couponCode});

  if (!coupon) {
      return res.status(400).json({ success: false, message: 'Invalid coupon code' });
  }

  // Validate if the coupon can be applied based on minimum price
  // const subtotal = req.body.subtotal; // Subtotal sent from the client
  // console.log("sub total = ",subtotal)
  // if (subtotal < coupon.offerPrice) {
  //     return res.status(400).json({
  //         success: false,
  //         message: `Coupon cannot be applied. Minimum purchase is ₹ ${coupon.minimumPrice}.`
  //     });
  // }
console.log("minimumprice = ",coupon.offerPrice)
//   // Return the discount amount and the minimum price for the coupon
  return res.json({
      success: true,
      
      minimumPrice: coupon.offerPrice,
  });
}
module.exports = {
  getCartPage,
  addToCart,
  changeQuantity,
  removeCartItem,
  loadCheckoutPage,
  updateCartItem,
  applyCoupon
};