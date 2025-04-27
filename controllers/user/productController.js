const User=require('../../models/userSchema')
const Category=require("../../models/categorySchema")
const Product=require("../../models/productSchema")
const mongoose = require('mongoose');

const loadShop=(req,res)=>{
   try {
      res.render("shop")
   } catch (error) {
      res.render("error")
   }
}

const filterProducts = async (req, res) => {
    try {
        const { search, category, minPrice, maxPrice, availability } = req.body;
        console.log("Received Filters:", req.body);

    

    } catch (error) {
        console.error('Error fetching filtered products:', error);
        res.status(500).send('Error fetching products');
    }
};


const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;
        
        const product = await Product.findById(productId)
            .populate('category')
            .populate('ratings.user');

        // Calculate average rating
        let averageRating = 0;
        if (product.ratings && product.ratings.length > 0) {
            const totalStars = product.ratings.reduce((sum, rating) => sum + rating.stars, 0);
            averageRating = totalStars / product.ratings.length;
        }

        // Calculate offers
        const findCategory = product.category;
        const categoryOffer = findCategory ? findCategory.categoryOffer : 0;
        const productOffer = product.productOffer || 0;
        const totalOffer = Math.max(categoryOffer, productOffer);

        // Get related products
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map(category => category._id.toString());

        const products = await Product.find({
            isBlocked: false,
            category: { $in: categoryIds },
            quantity: { $gt: 0 },
            _id: { $ne: productId } // Exclude current product
        })
        .sort({ createdOn: -1 })
        .limit(4);

        // Prepare variants data
        const variants = product.variants || [];
        const availableSizes = [...new Set(variants.map(v => v.size))];
        const availableColors = [...new Set(variants.map(v => v.color))];

        res.render("product-Details", {
            user: userData,
            product: {
                ...product.toObject(),
                availableSizes,
                availableColors
            },
            products,
            quantity: product.quantity,
            totalOffer,
            category: findCategory,
            averageRating,
        });
    } catch (error) {
        console.error("Error fetching product details", error);
        res.redirect("/pageNotFound");
    }
};
// Add this new route handler to your product controller
const updateProductVariant = async (req, res) => {
    try {
        const { productId, size, color } = req.body;
        
        const updateData = {};
        if (size) updateData.size = size;
        if (color) updateData.color = color;
        
        await Product.findByIdAndUpdate(productId, updateData);
        
        res.json({ success: true, message: 'Product variant updated' });
    } catch (error) {
        console.error('Error updating product variant:', error);
        res.status(500).json({ success: false, message: 'Error updating product variant' });
    }
};



module.exports={
    
    loadShop,
    filterProducts,
    productDetails,
    updateProductVariant
}