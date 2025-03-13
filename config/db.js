const mongoose = require("mongoose")
const env=require("dotenv").config()

//CONNECT MONGODB
const connectDB = async() => {
    try{
        const conn = await mongoose.connect(process.env.MONGODB_URI, {})
        console.log("Database connected")
    } catch(error){
        console.log("Database error",error.message)
        process.exit(1)
    }
}

module.exports = connectDB  