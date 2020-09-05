//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook");
const findOrCreate = require("mongoose-findorcreate");
//const encrypt = require("mongoose-encryption");


const app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "jaimatadi",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/secretDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String,
  facebookId: String,
  secrets:[String]
});

const querySchema = new mongoose.Schema({
  topic: String,
  query: String,
  answer:[String]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
//userSchema.plugin(encrypt, { secret: process.env.SECRET , encryptedFields:["secrets"] });

const User = new mongoose.model("User", userSchema);
const Query = new mongoose.model("Query", querySchema);

const query1 = new Query({
  topic:"",
  query:"",
  answer:[]
});

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/bracebook",
    userProfileURL:"https://WWW.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {

    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID:process.env.APP_ID,
    clientSecret: process.env.APP_SECRET,
    callbackURL: "http://localhost:3000/auth/fb/secrets",
    profileFields: ["id", "displayName", "photos", "email"]
  },
  function(accessToken, refreshToken, profile, cb) {

    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


app.get("/", function(req, res) {
  res.render("index");
});

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile"] }));


app.get("/auth/google/bracebook",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/queries");
  });

app.get('/auth/fb',
passport.authenticate('facebook'));

app.get('/auth/fb/secrets',
      passport.authenticate('facebook', { failureRedirect: "/login" }),
      function(req, res) {
        // Successful authentication, redirect home.
        res.redirect('/queries');
});

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/raise", function(req, res) {
  if (req.isAuthenticated()) {

    User.findById(req.user.id , function(err,foundUser){
      if(foundUser){
        res.render("submit");
      }
    });
  } else {
    console.log("not authenticated");
    res.redirect("/login");
  }

});

app.get("/submit",function(req,res){
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect('/');
});



app.get("/queries",function(req,res){
  Query.find({},function(err,foundQueries){
    if(!err){
      if(!foundQueries){
        query1.save();
        res.redirect("/queries");
      }else{
          res.render("queries",{queryList:foundQueries});
      }
    }
  });
});

app.get("/contact",function(req,res){
  res.render("contact");
});

app.get("/resources",function(req,res){
  res.render("resources");
});

app.get("/about",function(req,res){
  res.render("about");
});

app.post("/reply",function(req,res){
   const content = req.body.list;

   Query.findOne({topic:content},function(err,userFound){
     if(!err){
       if(userFound){
         res.render("replies",{queryList:userFound});
       }else{
         console.log("user not found");
       }
     }else{
       console.log("error found");
     }
   });
});

app.get("/:url",function(req,res){

  const newUrl = req.params.url;


  if (req.isAuthenticated()) {
    Query.findOne({topic:newUrl},function(err,result){
      if(!err){
        res.render("post",{topic:newUrl , newQuery:result});
      }
    });
  } else {
    res.redirect("/login");
  }

});


app.post("/login", function(req, res) {

  const newUser = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(newUser, function(err) {
    if (err) {
      res.redirect("/login");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/queries");
      });
    }
  });
});



app.post("/register", function(req, res) {
  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        console.log("succcess");
        res.redirect("/queries");
      });
    }
  });
});

app.post("/submit",function(req,res){

  const newQuery = new Query({
    topic:req.body.topic,
    query:req.body.queryName
  });

  User.findById( req.user.id , function(err,foundUser){
    if(err){
      console.log(err);
      res.redirect("/submit");
    }else{
      if(foundUser){
        newQuery.save();
        res.redirect("/queries");
      }
    }
  });
});


app.post("/post",function(req,res){
  const reply = req.body.reply;
  const title = req.body.topic;
  Query.findOne({topic : title},function(err , user){
    if(!err){
      if(user){
        user.answer.push(reply);
        user.save();
        res.redirect("/queries");
      }
    }
  })
});

app.listen(3000, function(req, res) {
  console.log("server is running at port 3000");
});
