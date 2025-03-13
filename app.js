const express = require('express');
const path = require('path');
const env = require("dotenv").config();
const ejs = require('ejs');
const userRouter = require('./routes/user');
const adminRouter = require('./routes/admin');
const Database = require("./config/db");
const session = require("express-session")
const passport = require('./config/passport');
const bodyParser = require('body-parser');

//this is for global users to login

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.use(passport.initialize());
app.use(passport.session());

// Set up views directory correctly (allowing multiple directories)
app.set("views", [path.join(__dirname, 'views/users'), path.join(__dirname, 'views/admins')]);

// Set the view engine to ejs
app.set("view engine", "ejs");

// Set up static folder (for serving images, CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));




app.use((req,res,next) => {
    res.set('Cache-Control','no-store')
    next();
})


// Set up routes for user and admin
// app.use('/', (req,res)=>{
//     res.render('home')
// })
app.use('/', userRouter);
app.use('/admin', adminRouter);


// Connect to the database
Database();

// Start the server
app.listen(3000, () => {
    console.log('Server is running on port http://localhost:3000');
});
