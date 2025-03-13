const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");

const getBrandPage = async (req, res) => {
  try {
    // Fix: Use `req.query.page` to get the page number from the query string
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    // Fix: Correctly chain the .find(), .sort(), .skip(), .limit() methods
    const brandData = await Brand.find({})
      .sort({ createdAt: -1 })  // Sort brands by createdAt in descending order
      .skip(skip)
      .limit(limit);

    // Calculate total number of brands to determine totalPages
    const totalBrands = await Brand.countDocuments();
    const totalPages = Math.ceil(totalBrands / limit);

    // No need to reverse the array since it's already sorted
    res.render("brands", {
      data: brandData,
      currentPage: page,
      totalPages: totalPages,
      totalBrands: totalBrands,
    });
  } catch (error) {
    console.error("Error fetching brand data:", error);
    res.redirect("/pageError");
  }
};

const addBrand=async(req,res)=>{
  try {
    const brand = req.body.name
    const findBrand=await Brand.findOne({brand})
    if(!findBrand){
      const image=req.file.filename;
      const newBrand=new Brand({
        brandName:brand,
        brandImage:image,
      })
      await newBrand.save()
      console.log("saved image")
      res.redirect("/admin/brands")
    }
    
  } catch (error) {
    res.redirect("/pageError")
  }
}
module.exports = {
  getBrandPage,
  addBrand
};
