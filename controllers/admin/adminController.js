const User =require("../../models/userSchema")
const mongoose =require("mongoose");
const bcrypt=require("bcrypt");
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const moment = require('moment');
const Chart = require('chart.js'); // For charting

const adminLogin = (req,res)=>{    
  try {
        res.render("adminhome");
  
  } catch (error) {
    console.log("error")
  }
}
const adminsignin = async (req, res) => {   
    try {
        console.log("Admin login attempt"); // Log to confirm the function is being triggered
        const { email, password } = req.body;
        console.log("Received email:", email); // Log email
        console.log("Received password:", password); // Log password

        // Check if email or password is empty
        if (!email || !password) {
            console.log("Email or password is missing");
            return res.redirect('/adminhome'); // Or send an error message
        }

        // Find user in the database
        const user = await User.findOne({ email });
        console.log("User found:", user); // Log the user object

        if (!user) {
            console.log("User not found");
            return res.redirect('/adminhome'); // User doesn't exist
        }

        // Compare password
        const passwordMatch = await bcrypt.compare(password, user.password);
        console.log("Password match result:", passwordMatch); // Log password comparison result

        if (passwordMatch) {
            if (user.isAdmin) {
                console.log("Admin logged in");
                console.log("Admin name: ", user.fullname); // Log to check the admin's name
                req.session.admin = user._id;
return res.redirect("/admin/dashboard")                
                // Correct rendering path
            } else {
                console.log("User is not an admin");
                return res.status(401).send("Invalid credentials or not an admin");
            }
        } else {
            console.log("Invalid password");
            return res.redirect('/adminhome');  // Redirect to login page or show error message
        }

    } catch (error) {
        console.error("Error during sign-in:", error); // Log the error message to the console
        return res.redirect("/pageError");
    }
};


const adminDashboard = async (req, res) => {
    try {
    
        let { startDate, endDate ,period} = req.body;

// Convert them to Date objects
startDate =  new Date(startDate) ;
endDate = new Date(endDate);

        
        console.log('startDate =',startDate)
        console.log("endDate",endDate)
        console.log("time period = ",period)
        const totalOrders = await Order.countDocuments() || 0;
        const productSold = await Order.countDocuments({ status: 'delivered' }) || 0;

        const revenueResult = await Order.aggregate([
            { $match: { status: 'delivered' } },
            { $group: { _id: null, totalRevenue: { $sum: '$finalAmount' } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
        const totalUsers = await User.countDocuments() || 0;

        const topProducts = await Order.aggregate([
            {
                $match: { status: 'delivered' } // Only consider delivered orders
            },
            {
                $unwind: '$orderItems' // Flatten the orderItems array
            },
            {
                $group: {
                    _id: '$orderItems.product', // Group by product ID
                    totalSold: { $sum: '$orderItems.quantity' },
                    revenue: {
                        $sum: {
                            $multiply: ['$orderItems.quantity', '$orderItems.price']
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'products', // Join with Product collection
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            {
                $unwind: {
                    path: '$productDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'categories', // Join with Category collection
                    localField: 'productDetails.category',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },
            {
                $unwind: {
                    path: '$categoryDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    productImg: {
                        $cond: [
                            { $gt: [{ $size: '$productDetails.productImage' }, 0] },
                            { $arrayElemAt: ['$productDetails.productImage', 0] },
                            '/images/default-product.jpg' // Fallback if no image
                        ]
                    },
                    productName: '$productDetails.productName',
                    categoryName: '$categoryDetails.name',
                    brand: '$productDetails.brand',
                    price: '$productDetails.salePrice',
                    stock: '$productDetails.quantity',
                    totalSold: 1,
                    revenue: 1
                }
            },
            { $sort: { totalSold: -1 } }, // Sort by total sold
            { $limit: 10 } // Top 10 products
        ]);
        
        console.log("product details : ",topProducts)

        const categorySales = await Order.aggregate([
            { $match: { status: 'delivered' } },
            { $unwind: '$orderItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'productDetails.category',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },
            { $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$categoryDetails._id',
                    categoryName: { $first: '$categoryDetails.name' },
                    totalSold: { $sum: '$orderItems.quantity' },
                    revenue: { $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] } }
                }
            },
            { $sort: { revenue: -1 } }
        ]) || [];

        
        const brandSales = await Order.aggregate([
            { $match: { status: 'delivered' } },
            { $unwind: '$orderItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$productDetails.brand',
                    brand: { $first: '$productDetails.brand' },
                    totalSold: { $sum: '$orderItems.quantity' },
                    revenue: { $sum: { $multiply: ['$orderItems.quantity', '$orderItems.price'] } }
                }
            },
            { $sort: { revenue: -1 } }
        ]) || [];

        console.log("category items :",categorySales)


            const revenueData = {
                day: await Order.aggregate([
                    { $match: { status: 'delivered' } },
                    {
                        $group: {
                            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdOn' } },
                            revenue: { $sum: '$finalAmount' }
                        }
                    },
                    { $sort: { '_id': -1 } },
                    { $limit: 30 }
                ]).then(result => ({
                    labels: result.map(r => r._id).reverse(),
                    revenues: result.map(r => r.revenue).reverse()
                })),
                month: await Order.aggregate([
                    { $match: { status: 'delivered' } },
                    {
                        $group: {
                            _id: { $dateToString: { format: '%Y-%m', date: '$createdOn' } },
                            revenue: { $sum: '$finalAmount' }
                        }
                    },
                    { $sort: { '_id': -1 } },
                    { $limit: 12 }
                ]).then(result => ({
                    labels: result.map(r => r._id).reverse(),
                    revenues: result.map(r => r.revenue).reverse()
                })),
                year: await Order.aggregate([
                    { $match: { status: 'delivered' } },
                    {
                        $group: {
                            _id: { $year: '$createdOn' },
                            revenue: { $sum: '$finalAmount' }
                        }
                    },
                    { $sort: { '_id': -1 } },
                    { $limit: 5 }
                ]).then(result => ({
                    labels: result.map(r => r._id.toString()).reverse(),
                    revenues: result.map(r => r.revenue).reverse()
                }))
            };

         // 4. Time-based Sales Data (for charts)
         const getSalesData = async (timePeriod) => {
            let groupBy = {};
            let limit = 0;
            
            switch(timePeriod) {
                case 'day':
                    groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdOn' } };
                    limit = 30;
                    break;
                case 'week':
                    groupBy = { $week: '$createdOn' };
                    limit = 12;
                    break;
                case 'month':
                    groupBy = { $dateToString: { format: '%Y-%m', date: '$createdOn' } };
                    limit = 12;
                    break;
                case 'year':
                    groupBy = { $year: '$createdOn' };
                    limit = 5;
                    break;
            }
            
            return await Order.aggregate([
                { $match: { status: 'delivered' } },
                {
                    $group: {
                        _id: groupBy,
                        revenue: { $sum: '$finalAmount' },
                        orderCount: { $sum: 1 }
                    }
                },
                { $sort: { '_id': 1 } },
                { $limit: limit }
            ]);
        };


  
        const salesData = {
            day: await getSalesData('day'),
            week: await getSalesData('week'),
            month: await getSalesData('month'),
            year: await getSalesData('year')
        };
        
        
      

        // 6. NEW: Comprehensive Sales Report with Date Filter
        const parsedStartDate = startDate;

        const salesReport = await Order.aggregate([
            {
                $match: {
                    createdOn: { $gte: parsedStartDate },
                    status: "delivered"
                }
            },
            { $unwind: "$orderItems" },
            {
                $group: {
                    _id: null,
                    totalrevenue: { $sum: "$orderItems.price" }
                }
            },
            { $addFields: { defaultRevenue: 0 } }
        ]);
        
        const salesitems = await Order.aggregate([
            {
                $match: {
                    createdOn: { $lte: new Date()},
                    status: "delivered"
                }
            },
            { $unwind: "$orderItems" }
        ]);
        
  
console.log('Sales report:', salesReport);
  console.log('Sales item:', salesitems);
console.log("salesData = ",salesData)

        res.render('dashboard', {
            totalOrders,
            totalRevenue,
            totalUsers,
            topProducts,
            categorySales,
            brandSales,
            productSold,
            revenueData,
            salesData,
            salesReport,
            salesitems
            
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).render('admins/dashboard', {
            totalOrders: 0,
            totalRevenue: 0,
            totalUsers: 0,
            productSold:0,
            topProducts: [],
            categorySales: [],
            brandSales: [],
            revenueData: { day: { labels: [], revenues: [] }, month: { labels: [], revenues: [] }, year: { labels: [], revenues: [] } },
            error: 'Failed to load dashboard data'
        });
    }
};



const adminLogout=async(req,res)=>{
    try{
        req.session.destroy(err=>{
            if(err){
                console.log("Error session Destroying",err)
                return res.redirect("/pageError")
            }
            res.redirect("/admin/login")
        })
    }catch(error){
        console.log("unexpected error happend during transaction",error)
        res.redirect("/pageError")
    }
}

const  pageError_404=(req,res)=>{
    res.render("pageError")         
}
// const admindata=async(req,res)=>{
//     if(req.session.admin)
//     {
//         res.send({message:req.session.admin})
//     }
// }

module.exports={
    adminLogin,
    adminsignin,
    adminDashboard,
    pageError_404,
    adminLogout
}