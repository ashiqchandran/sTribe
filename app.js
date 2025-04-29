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
const MongoStore = require('connect-mongo');
const createError = require('http-errors');
const User=require('./models/userSchema')

// Initialize Express app
const app = express();

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Express built-in middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration
// For User session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        secure: false, // Use true in production with HTTPS
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000, // 3 days
        name: 'user_sid',  // User session cookie name
    }
}));

// For Admin session (This session has its own separate cookie name)
app.use('/admin', session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'admin_sessions'  // Store admin sessions in a separate collection
    }),
    cookie: {
        secure: false, // Use true in production with HTTPS
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000, // 3 days
        name: 'admin_sid',  // Admin session cookie name
    }
}));

Database();
// Passport initialization
app.use(passport.initialize());
app.use(passport.session());


app.use(async (req, res, next) => {
    try {
        if (req.session.user) {
            const userId = req.session.user._id;
            const user = await User.findById(userId);

            if (user.isBlocked) {
                req.logout((err) => {
                    if (err) return next(err);

                    req.session.destroy((err) => {
                        if (err) {
                            console.error("Session destroy failed:", err);
                            
                        }

                        res.clearCookie('connect.sid');
                      
                    });
                });
                return;
            }
        }
        next();
    } catch (error) {
        console.error('Blocked check error:', error);
        next(error);
    }
});

// Local variables middleware
app.use((req, res, next) => {
    res.locals.user = req.user || req.session.user || null;
    next();
});

// View engine setup
app.set("views", [path.join(__dirname, 'views/users'), path.join(__dirname, 'views/admins')]);
app.set("view engine", "ejs");

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Cache control middleware
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Routes
app.use('/', userRouter);
app.use('/admin', adminRouter);

// 404 Handler - catch unmatched routes
app.use((req, res, next) => {
    next(createError(404, 'Page Not Found'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    // Set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // Log the error
    console.error(`[${new Date().toISOString()}] Error: ${err.message}`);
    console.error(err.stack);

    // Determine the status code
    const status = err.status || 500;

    // Render the error page or send JSON response based on Accept header
    if (req.accepts('html')) {
        res.status(status).render('error', {
            title: `Error ${status}`,
            status: status,
            message: err.message
        });
    } else if (req.accepts('json')) {
        res.status(status).json({
            error: {
                status: status,
                message: err.message
            }
        });
    } else {
        res.status(status).type('txt').send(`Error ${status}: ${err.message}`);
    }
});


// Database connection


// Server startup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});
