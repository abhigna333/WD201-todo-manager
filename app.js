/* eslint-disable no-undef */
const express = require("express");
const app = express();
const path = require("path");
const { Todo, User } = require("./models");
const bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var csrf = require("tiny-csrf");

const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStrategy = require("passport-local");

const bcrypt = require("bcrypt");
const saltRounds = 10;

const flash = require("connect-flash");




app.use(bodyParser.json());

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("shh! something secret"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));
app.use(express.static(path.join(__dirname,'public')));
app.use(flash());

app.use(session({
  secret: "my-super-secret-key-36734828947944847",
  cookie: {
    maxAge: 24 * 60 * 60 * 1000 //24 hrs
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(function(request, response, next) {
  response.locals.messages = request.flash();
  next();
});

passport.use(new LocalStrategy({
  usernameField: "email",
  passwordField: "password"
}, (username, password, done) => {
  User.findOne({ where: { email: username }})
    .then(async (user) => {
      const result = await bcrypt.compare(password, user.password)
      if(result){
        return done(null, user);
      }
      else {
        return done(null, false, { message: "Invalid password" });
      }
      
    }).catch((error) => {
      console.log(error);
      return done(null, false, { message: "You are not registered, Signup to register" });
    })
}));

passport.serializeUser((user, done) => {
  console.log("Serializing user in session", user.id)
  done(null, user.id)
});

passport.deserializeUser((id, done) =>{
  User.findByPk(id)
    .then(user => {
      done(null, user)
    }).catch(error => {
      done(error, null)
    })
});

app.get("/", async (request, response) => {
  if (request.user) { 
    response.redirect("/todos")
  } 
  else {
    response.render("index", {
    title: "Todo application",
    csrfToken: request.csrfToken(),
  });
 }
});

app.get(
  "/todos", 
  connectEnsureLogin.ensureLoggedIn(), 
  async (request, response) => {
  const loggedInUser = request.user.id;
  const name = await User.getName(loggedInUser);
  console.log(name);
  const overdue = await Todo.overdue(loggedInUser);
  const dueToday = await Todo.dueToday(loggedInUser);
  const dueLater = await Todo.dueLater(loggedInUser);
  const completed = await Todo.completed(loggedInUser);
  if (request.accepts("html")) {
    response.render("todos", {
      overdue,
      dueToday,
      dueLater,
      completed,
      title: "Todos application",
      username: name,
      csrfToken: request.csrfToken(),
    });
  } else {
    response.json({
      overdue,
      dueToday,
      dueLater,
      completed,
    });
  }
});

app.get(
  "/alltodos",
  connectEnsureLogin.ensureLoggedIn(),
  async function (request, response) {
    try {
      const todos = await Todo.getTodos(request.user.id);
      return response.json(todos);
    } catch (error) {
      return response.status(500).send(error);
    }
  }
);

app.get('/signup',(request,response)=>{
  response.render('signup',{
    title: 'Sign Up',
    csrfToken: request.csrfToken(),
  });
});

app.get("/login", (request, response) => {
  response.render("login", {
    title: "Login",
    csrfToken: request.csrfToken(),
  })
});

app.get("/signout", (request, response, next) => {
  request.logout((error) => {
    if(error) { return next(error); }
    response.redirect("/");
  })
})

app.post(
  "/session", 
  passport.authenticate("local", { 
    failureRedirect: "/login",
    failureFlash: true,
  }),
  function (request, response) {
  console.log(request.user)
  response.redirect("/todos")
});

app.post(
  "/todos", 
  connectEnsureLogin.ensureLoggedIn(), 
  async function (request, response) {

    if(!request.body.title) {
      request.flash("error", "Title cannot be empty");
    }

    if(!request.body.dueDate) {
      request.flash("error", "Due date cannot be empty");
    }

    if(!request.body.dueDate || !request.body.title) {
      return response.redirect("/todos");
    }

    try {
      await Todo.addTodo({
        title: request.body.title,
        dueDate: request.body.dueDate,
        userId: request.user.id,
      });
      return response.redirect("/todos");
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
});

app.post("/users", async (request, response) => {
  if(request.body.firstName === "") {
    request.flash("error", "First Name cannot be empty");
    
  }

  if(request.body.email === "") {
    request.flash("error", "Email cannot be empty")    
  }

  if(request.body.password === "") {
    request.flash("error", "Password cannot be empty")    
  }

  if(request.body.email === "" || request.body.firstName === "" || request.body.password === "") {
    return response.redirect("/signup") 
  }

  const hasedPwd = await bcrypt.hash(request.body.password, saltRounds);
  
  try {
    const user = await User.create({
        firstName: request.body.firstName,
        lastName: request.body.lastName,
        email: request.body.email,
        password: hasedPwd
      }); 
      request.login(user, (error) => {
        if(error) {
          console.log(error)
        }
        response.redirect("/todos");
      })
  } catch (error) {
    console.log(error);
  }
});



app.put(
  "/todos/:id", 
  connectEnsureLogin.ensureLoggedIn(), 
  async function (request, response) {
  const todo = await Todo.findByPk(request.params.id);
  
  try {
    const updatedTodo = await todo.setCompletionStatus(request.body.completed);
    return response.json(updatedTodo);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.delete("/todos/:id", connectEnsureLogin.ensureLoggedIn(), async function (request, response) {
  console.log("We have to delete a Todo with ID: ", request.params.id);
  // FILL IN YOUR CODE HERE
  
  try {
    await Todo.remove(request.params.id, request.user.id);
    return response.json({ success: true});
    //const todo_delete = await Todo.findByPk(request.params.id);
    // if (todo_delete != null) {
    //   await Todo.remove(request.params.id);
    //   return response.json({ success: true});
    // } 
    // else {
    //   return response.json({ success: false});
    // }

  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
  // First, we have to query our database to delete a Todo by ID.
  // Then, we have to respond back with true/false based on whether the Todo was deleted or not.
  // response.send(true)
});

module.exports = app;








//   console.log("Processing list of all Todos ...");
//   // FILL IN YOUR CODE HERE
//   try {
//     const todos = await Todo.getAllTodos();
//     return response.send(todos);
//   } catch (error) {
//     console.log(error);
//     return response.status(422).json(error);
//   }
  // First, we have to query our PostgerSQL database using Sequelize to get list of all Todos.
  // Then, we have to respond with all Todos, like:
  // response.send(todos)
// });

// app.get("/todos/:id", async function (request, response) {
//   try {
//     const todo = await Todo.findByPk(request.params.id);
//     return response.json(todo);
//   } catch (error) {
//     console.log(error);
//     return response.status(422).json(error);
//   }
// });
