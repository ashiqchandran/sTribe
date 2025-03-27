const Coupon = require("../../models/couponSchema")
const mongoose = require("mongoose")


const loadCoupon = async (req,res) => {
    try {

        const findCoupons = await Coupon.find({})
        

        return res.render("coupons",{coupons:findCoupons})

    } catch (error) {
        return res.redirect("/pageerror")
        
    }
}

const createCoupon = async (req,res) => {
    try {
        
        
    const data = {
        couponName:req.body.couponName,
        startDate: new Date(req.body.startDate + "T00:00:00"),
        endDate: new Date(req.body.endDate + "T00:00:00"),
        offerPrice: parseInt(req.body.offerPrice),
        minimumPrice: parseInt(req.body.minimumPrice),
    }

    const newCoupon = new Coupon({
        name:data.couponName,
        createdOn: data.startDate,
        expireOn: data.endDate,
        offerPrice: data.offerPrice,
        minimumPrice: data.minimumPrice
    })
console.log("coupon = ",newCoupon)
    await newCoupon.save()

    return res.redirect("/admin/coupon")

    } catch (error) {

        res.redirect("/pageerror")
        
    }
}

const editCoupon = async (req,res) => {
    try {

        const id = req.query.id;
        const findCoupon = await Coupon.findOne({_id:id});

        res.render("edit-coupon",{
            findCoupon:findCoupon,

        })
        
    } catch (error) {

        res.redirect("/pageerror")
        
    }
}


const updateCoupon = async (req, res) => {
    try {
        // Get the couponId from the request q
        console.log("coupon update came here")
        const couponId = req.body.couponId || req.query.couponId;
        console.log("Coupon ID:", couponId);

        // Check if couponId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(couponId)) {
            return res.status(400).json({ message: "Invalid coupon ID" });
        }

        // Convert couponId to ObjectId
        const oid = new mongoose.Types.ObjectId(couponId);

        // Check if coupon exists in the database
        const selectedCoupon = await Coupon.findOne({ _id: oid });
        if (!selectedCoupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }

        // Extract the other fields from the request body
        const { couponName, startDate, endDate, offerPrice, minimumPrice } = req.body;

        // Ensure valid data for offerPrice and minimumPrice
        if (isNaN(offerPrice) || isNaN(minimumPrice)) {
            return res.status(400).json({ message: "Offer Price and Minimum Price must be valid numbers" });
        }

        // Format startDate and endDate into Date objects
        const startDateObj = new Date(startDate + "T00:00:00");
        const endDateObj = new Date(endDate + "T00:00:00");

        // Perform the update operation
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponId, // Use couponId directly
            {
                $set: {
                    name: couponName,
                    createdOn: startDateObj,
                    expiredOn: endDateObj,
                    offerPrice: parseInt(offerPrice, 10),
                    minimumPrice: parseInt(minimumPrice, 10),
                }
            },
            { new: true } // Return the updated document
        );

        // Check if the update was successful
        if (!updatedCoupon) {
            return res.status(500).json({ message: "Error updating coupon" });
        }

        // Respond with the updated coupon data
        res.json({ message: "Coupon updated successfully", coupon: updatedCoupon });

    } catch (error) {
        console.error("Error updating coupon:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const deleteCoupon = async (req,res) => {
    try {
        console.log("delete came here")
       
return res.render('coupons')
    } catch (error) {
        console.error("Error Deleting Coupon",error)
        res.status(500).send({success:false,message:"Internal Server Error"})
    }
}




module.exports = {
    loadCoupon,
    createCoupon,
    editCoupon,
    updateCoupon,
    deleteCoupon,


}