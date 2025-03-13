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
        const cart = await Cart.findOne({ userId, "items.productId": productId });
        if (cart) {
            return res.json({ success: false, message: "Item is already in the cart!" });
        }

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

module.exports={
    loadWishlist,
    addToWishlist,
    deleteFromWishlist
}