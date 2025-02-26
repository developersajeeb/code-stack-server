const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: "./.env" });
const app = express();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.d9amltv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("codeStack").collection("users");
    const questionsCollection = client.db("codeStack").collection("questions");
    const answerCollection = client.db("codeStack").collection("answers");
    const saveCollection = client.db("codeStack").collection("saves");

    //JWT
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "30d",
      });
      res.send({ token });
    });

    // Get all users
    app.get("/users", async (req, res) => {
      const limit = parseInt(req.query.limit) || 18;
      const skip = parseInt(req.query.skip) || 0;

      const result = await usersCollection
        .find()
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await usersCollection.countDocuments();

      res.send({ users: result, total });
    });

    //Post users data to database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }
      user.role = user.role || 'normalUser'; // Default to normalUser if no role is provided
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Get Google user by email
    app.get("/users/google/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email, entryPoint: "google" });

        if (!user) {
          return res.status(404).send({ message: "User not found with this Google account" });
        }

        res.send(user);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
      }
    });

    //Get admin using email query  
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.status(403).send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // Change user role
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const newRole = req.body.role;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: newRole,
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/users/normalUser/:id", async (req, res) => {
      const id = req.params.id;
      const newRole = req.body.role;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: newRole,
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //Get User With Email Query
    app.get('/user', async (req, res) => {
      const userEmail = req.query.email;
      const query = { email: userEmail };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    //Get User With Username Query
    app.get('/user-by-username', async (req, res) => {
      const username = req.query.username;
      const query = { username: username };
      try {
        const result = await usersCollection.findOne(query);
        if (result) {
          res.send(result);
        } else {
          res.status(404).send({ message: "User not found" });
        }
      } catch (error) {
        res.status(500).send({ message: "Error fetching user", error: error.message });
      }
    });

    // Update user info
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const filter = { email: email }
      const options = { upsert: true };
      const updatedUser = req.body;
      const newUser = {
        $set: {
          name: updatedUser.name,
          imgURL: updatedUser.imgURL,
          age: updatedUser.age,
          gender: updatedUser.gender,
          portfolioURL: updatedUser.portfolioURL,
          country: updatedUser.country,
          city: updatedUser.city,
          facebookURL: updatedUser.facebookURL,
          twitterURL: updatedUser.twitterURL,
          githubURL: updatedUser.githubURL,
          selected: updatedUser.selected,
          aboutMe: updatedUser.aboutMe,
        }
      }
      const result = await usersCollection.updateOne(filter, newUser, options);
      res.send(result)
    })

    // Check valid or non valid username
    app.get("/check-username", async (req, res) => {
      const username = req.query.username;

      const query = { username: username };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        res.send({ success: false, message: "Username already exists!" });
      } else {
        res.send({ success: true, message: "You can take it!" });
      }
    });

    // Post a questions data
    app.post("/questions", async (req, res) => {
      const quesData = req.body;
      const result = await questionsCollection.insertOne(quesData);
      res.send(result);
    });

    //Get the Questions
    app.get("/questions", async (req, res) => {
      try {
        const skip = parseInt(req.query.skip) || 0;
        const limit = parseInt(req.query.limit) || 10;
        const result = await questionsCollection.find().sort({ _id: -1 }).skip(skip).limit(limit).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
      }
    });

    // Get Questions by Tag
    app.get("/questions-by-tag", async (req, res) => {
      try {
        const { tag } = req.query;
        const trimmedTag = tag.trim();
        const skip = parseInt(req.query.skip) || 0;
        const limit = parseInt(req.query.limit) || 10;

        const result = await questionsCollection
          .find({ selected: { $regex: new RegExp(`^${trimmedTag}$`, "i") } })
          .sort({ _id: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
      }
    });

    //Update question details
    app.put('/update-question/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedQuestion = req.body;
      const newQuestionData = {
        $set: {
          title: updatedQuestion.title,
          body: updatedQuestion.body,
          selected: updatedQuestion.selected,
          problemImages: updatedQuestion.problemImages,
        }
      }
      const result = await questionsCollection.updateOne(filter, newQuestionData, options);
      res.send(result)
    })

    //Get Details with id
    app.get('/question-details/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await questionsCollection.findOne(query);
      res.send(result);
    })

    //Post Answers
    app.post("/answers", async (req, res) => {
      const ansData = req.body;
      const result = await answerCollection.insertOne(ansData);
      res.send(result);
    });

    //Get Answers
    app.get("/answers", async (req, res) => {
      const result = await answerCollection.find().sort({ _id: -1 }).toArray();
      res.send(result);
    })

    //Get 10 Answers in every click
    app.get("/tenAnswer", async (req, res) => {
      try {
        const skip = parseInt(req.query.skip) || 0;
        const limit = parseInt(req.query.limit) || 10;
        const result = await answerCollection.find().sort({ _id: -1 }).skip(skip).limit(limit).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
      }
    });

    // Update an Answer
    app.put("/answers/:id", async (req, res) => {
      const id = req.params.id;
      const updatedAnswer = req.body;

      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: updatedAnswer,
        };
        const result = await answerCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error updating answer.", error: error.message });
      }
    });

    //Delete Answer
    app.delete('/delete-answer/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await answerCollection.deleteOne(query)
      res.send(result);
    })

    //Set the answer id in the questions
    app.patch('/question/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedUser = req.body;
      const newData = {
        $set: {
          answersId: updatedUser.answersId,
        }
      }
      const result = await questionsCollection.updateOne(filter, newData);
      res.send(result)
    })

    //ID query for the get answer
    app.get('/answer/:id', async (req, res) => {
      const id = req.params.id;
      const query = { questionID: id }
      const result = await answerCollection.find(query).toArray();
      res.send(result);
    })

    //Email query for the get questions
    app.get('/single-user-all-questions/:email', async (req, res) => {
      const email = req.params.email;

      try {
        const user = await usersCollection.findOne({ email });
        const userQuestions = await questionsCollection.find({ email }).toArray();
        const questionCount = userQuestions.length;

        let milestoneReached = false;

        if ([5, 10, 20].includes(questionCount) && !user.manualLevelUpdate) {
          milestoneReached = true;

          await usersCollection.updateOne(
            { email },
            { $set: { manualLevelUpdate: true } }
          );
        }

        if (questionCount !== 5 && questionCount !== 10 && questionCount !== 20 && user.manualLevelUpdate) {
          await usersCollection.updateOne(
            { email },
            { $set: { manualLevelUpdate: false } }
          );
        }

        res.send({
          questions: userQuestions,
          questionCount,
          manualLevelUpdate: milestoneReached || user.manualLevelUpdate
        });

      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
      }
    });

    // Update Level
    app.put('/update-level/:email', async (req, res) => {
      const email = req.params.email;

      try {
        await usersCollection.updateOne(
          { email },
          { $set: { manualLevelUpdate: false } }
        );
        res.json({ message: "Milestone marked as read." });

      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update manualLevelUpdate." });
      }
    });

    // Ten Question Get With Specific user
    app.get('/questions/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const limit = parseInt(req.query.limit) || 10;
        const skip = parseInt(req.query.skip) || 0;

        const query = { email: email };

        const result = await questionsCollection.find(query).sort({ _id: -1 }).skip(skip).limit(limit).toArray();

        if (result.length === 0) {
          return res.status(404).send({ message: 'No questions found' });
        }

        res.status(200).send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    //Delete Questions
    app.delete('/delete-question/:id', async (req, res) => {
      const id = req.params.id;

      const question = await questionsCollection.findOne({ _id: new ObjectId(id) });
      if (!question) {
        return res.status(404).send({ message: "Question not found" });
      }

      const result = await questionsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    //Email query for the get Answers
    app.get('/single-user-answers/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await answerCollection.find(query).toArray();
      res.send(result);
    })

    //Email query for the get 10 Answers
    app.get("/answers/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const skip = parseInt(req.query.skip) || 0;
        const limit = parseInt(req.query.limit) || 10;
        const result = await answerCollection.find({ email: email }).sort({ _id: -1 }).skip(skip).limit(limit).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
      }
    })

    //Question Vote api (Like)
    app.post('/vote/:id', async (req, res) => {
      const queId = req.params.id;
      const user = req.body.email;
      const filter = { _id: new ObjectId(queId) };
      const updateDoc = {
        $addToSet: { QuestionsVote: user }
      };

      try {
        const updateResult = await questionsCollection.updateOne(
          { ...filter, QuestionsVote: { $ne: user } },
          updateDoc
        );
        if (updateResult.matchedCount === 0) {
          return res.status(400).send({ message: 'User has already voted or question not found.' });
        }
        res.send({ updateResult });
      } catch (error) {
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // Question Vote API (Unlike)
    app.delete('/vote/:id', async (req, res) => {
      const queId = req.params.id;
      const user = req.body.email;
      const filter = { _id: new ObjectId(queId) };
      const updateDoc = {
        $pull: { QuestionsVote: user }
      };

      try {
        const updateResult = await questionsCollection.updateOne(filter, updateDoc);
        if (updateResult.matchedCount === 0) {
          return res.status(400).send({ message: 'User had not voted or question not found.' });
        }
        res.send({ updateResult });
      } catch (error) {
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    //Total Question View Count
    app.patch("/questions/:id/increment-view", async (req, res) => {
      const questionId = req.params.id;

      try {
        const result = await questionsCollection.updateOne(
          { _id: new ObjectId(questionId) },
          { $inc: { totalViews: 1 } }
        );

        if (result.modifiedCount === 1) {
          res.status(200).json({ message: "View count incremented successfully" });
        } else {
          res.status(404).json({ error: "Question not found" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
      }
    });

    // Get all tag
    app.get("/tags", async (req, res) => {
      try {
        const questions = await questionsCollection.find().toArray();
        const selectedItemsCounts = {};

        questions.forEach((question) => {
          if (Array.isArray(question.selected)) {
            question.selected.forEach((item) => {
              const normalizedItem = item.trim().toLowerCase();

              if (selectedItemsCounts[normalizedItem]) {
                selectedItemsCounts[normalizedItem]++;
              } else {
                selectedItemsCounts[normalizedItem] = 1;
              }
            });
          }
        });

        const tagArray = Object.keys(selectedItemsCounts).map((key) => ({
          name: key,
          count: selectedItemsCounts[key],
        }));

        tagArray.sort((a, b) => b.count - a.count);

        res.json(tagArray);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
      }
    });

    //Search API
    app.get("/search", async (req, res) => {
      try {
        const { query } = req.query;

        if (!query) {
          return res.status(400).json({ error: "Type something" });
        }

        const regex = new RegExp(query, "i");

        const results = await questionsCollection.find({
          $or: [
            { title: regex },
            { selected: { $elemMatch: { $regex: regex, $options: "i" } } }
          ]
        }).toArray();

        res.json(results);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
      }
    });

    //Save the questions
    app.post("/saves", async (req, res) => {
      const savesData = req.body;
      const { questionID, userEmail } = savesData;

      const existingSave = await saveCollection.findOne({ questionID, userEmail });

      if (existingSave) {
        const result = await saveCollection.deleteOne({ questionID, userEmail });
        res.send({ message: "Question unsaved!", action: "unsaved", result });
      } else {
        const result = await saveCollection.insertOne(savesData);
        res.send({ message: "Saved this question!", action: "saved", result });
      }
    });

    //Get Save data with email query (Every Click 10 Data Given)
    // app.get('/save/:email', async (req, res) => {
    //   const email = req.params.email;
    //   const query = { userEmail: email }
    //   const result = await saveCollection.find(query).toArray();
    //   res.send(result);
    // })

    //Get Save data with email query (Every Click 10 Data Given)
    app.get('/single-user-saves/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const limit = parseInt(req.query.limit) || 10;
        const skip = parseInt(req.query.skip) || 0;

        const query = { userEmail: email }

        const result = await saveCollection.find(query).sort({ _id: -1 }).skip(skip).limit(limit).toArray();

        if (result.length === 0) {
          return res.status(404).send({ message: 'No saved questions found!' });
        }

        res.status(200).send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Server error' });
      }
    });

    app.get('/check-saved/:questionID/:email', async (req, res) => {
      const { questionID, email } = req.params;

      try {
        const isSaved = await saveCollection.findOne({
          questionID: questionID,
          userEmail: email
        });

        if (isSaved) {
          return res.json({ isSaved: true });
        } else {
          return res.json({ isSaved: false });
        }

      } catch (error) {
        console.error("Error checking saved status:", error);
        res.status(500).json({ error: 'An error occurred' });
      }
    });

    //Get All Saves Data
    app.get("/saves", async (req, res) => {
      const result = await saveCollection.find().toArray();
      res.send(result);
    })

    // Top 5 selected Tag
    app.get('/top-tags', async (req, res) => {
      try {
        const questions = await questionsCollection.find().toArray();
        const tags = [];

        questions.forEach(question => {
          if (Array.isArray(question.selected)) {
            question.selected.forEach(item => {
              tags.push(item.trim().toLowerCase());
            });
          }
        });

        const tagCounts = tags.reduce((acc, tag) => {
          acc[tag] = (acc[tag] || 0) + 1;
          return acc;
        }, {});

        const sortedTags = Object.keys(tagCounts)
          .map(tag => ({ tagName: tag, count: tagCounts[tag] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        res.json(sortedTags);
      } catch (error) {
        res.status(500).send(error.message);
      }
    });

    // Top 5 Hot Question
    app.get('/hot-questions', async (req, res) => {
      try {
        const result = await questionsCollection.aggregate([
          {
            $addFields: {
              likeCount: {
                $size: {
                  $ifNull: ["$QuestionsVote", []]
                }
              }
            }
          },
          { $sort: { likeCount: -1 } },
          { $limit: 5 },
          { $project: { _id: 1, title: 1, likeCount: 1 } }
        ]).toArray();

        res.json(result);
      } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'An error occurred while fetching hot questions.' });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});
app.listen(port, () => {
  console.log(`app is running on port: ${port}`);
});