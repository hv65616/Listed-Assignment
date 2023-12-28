const { google } = require("googleapis");

/*
  You can use this url https://developers.google.com/workspace/guides/get-started and follow all the 5 steps to get started
  That will help you to steup your project and use the google gmail api functionality
  Once you do that you will get the clientid and clientsecret
  This refreshtoken is generated from the redirected uri https://developers.google.com/oauthplayground
    and here authorized this https://mail.google.com scope api by email and in setting of scope api by putting client id and client secret then when authorizes done this generate 
    authorization code .
    Exchange authorization code for refresh token by clicking on exchange text. 
  */
const {
  CLIENT_ID,
  CLEINT_SECRET,
  REDIRECT_URI,
  REFRESH_TOKEN,
} = require("./credentials");

//basically OAuth2 module allow to retrive an access token, refresh it and retry the request.
const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLEINT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

//keep track of users already replied to using repliedUsers. The use of Set() take care that no double replies are sent to any mail at any point.
const repliedUsers = new Set();

//Step 1. check for new emails and sends replies .
async function checkEmailsAndSendReplies() {
  try {
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // Get the list of unread messages.
    const res = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
    });
    const messages = res.data.messages;

    if (messages && messages.length > 0) {
      // Fetch the complete message details.
      for (const message of messages) {
        // the for loop fetch all the emails one by one and get the email where user id is me. And store that particular mail into "const email".
        // Now this email has all the details of a particular email which you can fetch and use as per your need

        const email = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
        });
        const fromHeader = email.data.payload.headers.find(
          (header) => header.name === "From"
        );
        console.log(fromHeader.value); // johndoe@example.com*/
        const from = email.data.payload.headers.find(
          (header) => header.name === "From"
        );
        const toHeader = email.data.payload.headers.find(
          (header) => header.name === "To"
        );
        const Subject = email.data.payload.headers.find(
          (header) => header.name === "Subject"
        );
        //who sends email extracted
        const From = from.value;
        //who gets email extracted
        const toEmail = toHeader.value;
        //subject of unread email
        const subject = Subject.value;
        console.log("email come From", From);
        console.log("to Email", toEmail);
        //check if the user already been replied to
        if (repliedUsers.has(From)) {
          console.log("Already replied to : ", From);
          continue;
        }
        // 2.send replies to Emails that have no prior replies
        // Check if the email has any replies.
        const thread = await gmail.users.threads.get({
          userId: "me",
          id: message.threadId,
        });

        //isolated the email into threads
        const replies = thread.data.messages.slice(1);

        if (replies.length === 0) {
          // Reply to the email.
          await gmail.users.messages.send({
            userId: "me",
            requestBody: {
              raw: await createReplyRaw(toEmail, From, subject),
            },
          });

          // Add a label to the email.
          const labelName = "onVacation";
          await gmail.users.messages.modify({
            userId: "me",
            id: message.id,
            requestBody: {
              addLabelIds: [await createLabelIfNeeded(labelName)],
            },
          });

          console.log("Sent reply to email:", From);
          //Add the user to replied users set
          repliedUsers.add(From);
        }
      }
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

//this function is basically converte string to base64EncodedEmail format
async function createReplyRaw(from, to, subject) {
  const emailContent = `From: ${from}\nTo: ${to}\nSubject: ${subject}\n\n Thank You for contacting me. I am currently offline but i would love to connect with you once i come online. So wait till then`;
  const base64EncodedEmail = Buffer.from(emailContent)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return base64EncodedEmail;
}

// 3.add a Label to the email and move the email to the label
async function createLabelIfNeeded(labelName) {
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  // Check if the label already exists.
  const res = await gmail.users.labels.list({ userId: "me" });
  const labels = res.data.labels;

  const existingLabel = labels.find((label) => label.name === labelName);
  if (existingLabel) {
    return existingLabel.id;
  }

  // Create the label if it doesn't exist.
  const newLabel = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: labelName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });

  return newLabel.data.id;
}

/*4.repeat this sequence of steps 1-3 in random intervals of 45 to 120 seconds*/
function getRandomInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

//Setting Interval and calling main function in every interval
setInterval(checkEmailsAndSendReplies, getRandomInterval(45, 120) * 1000);
