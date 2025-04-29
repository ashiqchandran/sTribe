const Wishlist = require('../../models/wishlistSchema')
const Product = require('../../models/productSchema')
const Cart= require('../../models/cartSchema')
const express= require('express')
const router= express.Router()
const mongoose = require('mongoose');

const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) return res.redirect("/login");

        let wishlist = await Wishlist.findOne({ userId }).populate("products.productId").lean();

        if (wishlist) {
            
            const validProducts = wishlist.products.filter(item => item.productId !== null);

            
            if (validProducts.length !== wishlist.products.length) {
                await Wishlist.updateOne({ userId }, { $set: { products: validProducts } });
            }

            wishlist.products = validProducts;
        }

        res.render("wishlist", { wishlist });
    } catch (error) {
        console.error(" Error fetching wishlist:", error);
        res.status(500).send("Internal Server Error");
    }
};


const addToWishlist = async (req, res) => {
    try {
        const user = req.session.user;
        if (!user || !user._id) {
            return res.status(401).json({ success: false, message: "Please log in first" });
        }
        const userId = new mongoose.Types.ObjectId(user._id);

        if (!req.query.id) {
            return res.status(400).json({ success: false, message: "Product ID is required" });
        }
        const productId = new mongoose.Types.ObjectId(req.query.id);

        // ✅ Ensure product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // ✅ Check if product is in cart
        // const cart = await Cart.findOne({ userId, "items.productId": productId });
        // if (cart) {
        //     return res.json({ success: false, message: "Item is already in the cart!" });
        // }

        // ✅ Get Wishlist
        let wishlist = await Wishlist.findOne({ userId });

        // 🔹 If no wishlist exists, create one
        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }

        // 🔹 Debug: Print all stored products in wishlist
        console.log("Stored Wishlist Products:", wishlist.products.map(item => item.productId.toString()));
        console.log("Product to Add:", productId.toString());

        // ✅ Fix: Ensure proper comparison of ObjectIds
        const productExists = wishlist.products.some((item) => 
            item.productId.equals(productId) // MongoDB ObjectId comparison
        );

        if (!productExists) {
            wishlist.products.push({ productId });

            // 🔹 DEBUG: Log Before Saving
            console.log("Wishlist Before Save:", JSON.stringify(wishlist, null, 2));

            await wishlist.save();

            // 🔹 DEBUG: Confirm Save Worked
            const updatedWishlist = await Wishlist.findOne({ userId });
            console.log("Wishlist After Save:", JSON.stringify(updatedWishlist, null, 2));

            return res.json({ success: true, message: "Product added to wishlist" });
        } else {
            return res.json({ success: false, message: "Product already in wishlist" });
        }
    } catch (error) {
        console.error("Error adding to wishlist:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


const deleteFromWishlist= async (req,res)=>{
    try {
        const userId = req.session.user;
        if (!userId) return res.redirect("/login");

        const productId = req.query.id;
        await Wishlist.updateOne({ userId }, { $pull: { products: { productId } } });

        return res.redirect("/wishlist");
    } catch (error) {
        console.error("Error removing from wishlist:", error);
        return res.status(500).send("Internal Server Error");
    }
}


const addToCart = async (req, res) => {
    try {
        console.log("hai from addToCart")
        const userId = req.session.user;
        if (!userId) return res.status(401).json({ success: false, message: "Please log in to add items to the cart" });

        const productId = req.query.id;
        const quantity = parseInt(req.query.quantity) || 1;
        const product = await Product.findById(productId); // check for valid product
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

        // Remove the item from the wishlist after adding it to the cart
        await Wishlist.findOneAndUpdate(
            { userId }, 
            { $pull: { products: { productId } } } // Remove the product from the wishlist
        );

        res.json({ success: true, message: "Product added to cart and removed from wishlist" });

    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

  

module.exports={
    loadWishlist,
    addToWishlist,
    deleteFromWishlist,
    addToCart
}