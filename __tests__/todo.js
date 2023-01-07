/* eslint-disable no-undef */
const request = require("supertest");
var cheerio = require("cheerio");

const db = require("../models/index");
const app = require("../app");

let server, agent;

function extractCsrfToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
  
}

const login = async (agent, username, password) => {
  let res = await agent.get("/login");
  let csrfToken = extractCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password: password,
    _csrf: csrfToken,
  });
};

describe("Todo Application", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(4000, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });

  test("Sign up", async () => {
    let res = await agent.get("/signup");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "User A",
      email: "user.a@test.com",
      password: "user.a",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("Sign out", async() => {
    let res = await agent.get("/todos");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/todos");
    expect(res.statusCode).toBe(302);
  })

  test("Creates a todo and responds with json at /todos POST endpoint", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "user.a");
    const res = await agent.get("/todos");
    const crsfToken = extractCsrfToken(res);
    const response = await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: crsfToken,
    });
    expect(response.statusCode).toBe(302);
    
  });

  test("Updates a todo with the given ID on its completion status", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "user.a");
    let res = await agent.get("/todos");
    let crsfToken = extractCsrfToken(res);
    await agent.post("/todos").send({
      title: "Buy milk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: crsfToken,
    });
    
    const groupedTodosResponse = await agent  
      .get("/todos")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text);
    const dueTodayCount = parsedGroupedResponse.dueToday.length;
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1];
    
    res = await agent.get("/todos");
    crsfToken = extractCsrfToken(res);

    var markCompletedResponse = await agent.put(`/todos/${latestTodo.id}`).send({
      _csrf: crsfToken,
      completed: true,
    });
    var parsedUpdateResponse = JSON.parse(markCompletedResponse.text);
    expect(parsedUpdateResponse.completed).toBe(true);

    res = await agent.get("/todos");
    crsfToken = extractCsrfToken(res);

    markCompletedResponse = await agent.put(`/todos/${latestTodo.id}`).send({
      _csrf: crsfToken,
      completed: false,
    });
    parsedUpdateResponse = JSON.parse(markCompletedResponse.text);
    expect(parsedUpdateResponse.completed).toBe(false);
  });

  // test("Fetches all todos in the database using /todos endpoint", async () => {
  //   await agent.post("/todos").send({
  //     title: "Buy xbox",
  //     dueDate: new Date().toISOString(),
  //     completed: false,
  //   });
  //   await agent.post("/todos").send({
  //     title: "Buy ps3",
  //     dueDate: new Date().toISOString(),
  //     completed: false,
  //   });
  //   const response = await agent.get("/todos");
  //   const parsedResponse = JSON.parse(response.text);

  //   expect(parsedResponse.length).toBe(4);
  //   expect(parsedResponse[3]["title"]).toBe("Buy ps3");
  // });

  test("Deletes a todo with the given ID if it exists and sends a boolean response", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "user.a");
    let res = await agent.get("/todos");
    let crsfToken = extractCsrfToken(res);
    await agent.post("/todos").send({
      title: "Complete task 6",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: crsfToken,
    });
    
    const groupedTodosResponse = await agent  
      .get("/todos")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text);
    const dueTodayCount = parsedGroupedResponse.dueToday.length;
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1];

    res = await agent.get("/todos");
    crsfToken = extractCsrfToken(res);

    const deletedResponse = await agent.put(`/todos/${latestTodo.id}`).send({
      _csrf: crsfToken,
    });
    
    expect(deletedResponse.statusCode).toBe(200);
  });
});
