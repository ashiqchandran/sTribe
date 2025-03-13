
const benner=require("../../models/bannerSchema")

const getBanner= async(req,res)=>{

    try {
       res.render("banner.ejs") 
    } catch (error) {
        
    }
}
module.exports={
    getBanner
}