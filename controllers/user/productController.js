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


const productDetails = async (req,res) => {

    try {

        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;
        const product = await Product.findById(productId).populate('category')
        const findCategory = product.category;
        const categoryOffer = findCategory ?. categoryOffer || 0;
        const productOffer = product.productOffer ||0;

        const totalOffer = categoryOffer + productOffer;

        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map(category => category._id.toString());

        const products = await Product.find({
            isBlocked: false,
            category: { $in: categoryIds },
            quantity: { $gt: 0 },
        })
        .sort({ createdOn: -1 })
        .skip(0)
        .limit(9);

        res.render("product-Details",{
            user:userData,
            product:product,
            products: products,
            quantity:product.quantity,
            totalOffer:totalOffer,
            category:findCategory
        })


    } catch (error) {
        
        console.error("Error for fetching product details",error)
        res.redirect("/pageNotFound")
    }
}


module.exports={
    
    loadShop,
    filterProducts,
    productDetails
}