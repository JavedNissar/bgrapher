'use strict';

const telegram = require('telegram-node-bot');
const TelegramBaseController = telegram.TelegramBaseController;
const tg = new telegram.Telegram(process.env.BGRAPHER_TOKEN);
const datejs = require('datejs');
const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const http = require('http');

const GRATEFUL = 'GRATEFUL';
const MISTAKE = 'MISTAKE';
const COMPLETE = 'COMPLETE';

mongoose.connect(process.env.MONGODB_URI);

// Returns a random integer between min (included) and max (excluded)
// Using Math.round() will give you a non-uniform distribution!
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function ensureTwoDigits(number){
  let numberString = number.toString();
  if(numberString.length == 1){
    numberString = "0" + numberString;
  }
  return numberString;
}

let gratefulAcknowledgements = ["That sounds great!","Awesome!","Good.","Thanks for letting me know.","Okay."];
let gratefulFollowups = ["What else are you grateful for?",
"Can you tell me something else you're grateful for?",
"Tell me about what else you're grateful for.",
"Tell me about something else you're grateful for.",
"Do you mind telling me about something else you're grateful for?"];

let mistakeAcknowledgements = ["That sounds terrible!",
"That sounds horrible!",
"My apologies for your troubles.",
"Oh, that sucks!",
"Crap, that sounds really bad."];

let mistakeFollowups = ["Can you tell me some other mistakes you made today.",
"Do you mind telling me what other mistakes you made today.",
"What other mistakes did you make today?",
"How about you tell me about some other mistakes you made today.",
"Mind telling me what other mistakes you made today?"];



let userSchema = new mongoose.Schema({
  //ID of the user on Telegram
  user_id:{type:Number,required:true,unique:true,dropDups:true,index:true},
  /*status of the user indicating whether they are currently being grateful,
  detailing their mistakes, or if they're done talking
  */
  status:{type:String,required:true},
  /*the time in seconds since the start of the day that the user requested
  a session should start*/
  time:{type:Number,required:true}
})
//Validator to ensure a notification whenever the uniqueness of user_id is violated
userSchema.plugin(uniqueValidator);

let User = mongoose.model('User', userSchema);

//detailing the commands if the user needs that
class HelpController extends TelegramBaseController{
  helpHandler($){
    $.sendMessage("/start will begin a new session");
    $.sendMessage("/done can indicate that you're done being grateful if you are currently telling me what you're grateful for");
    $.sendMessage("If you're telling me your mistakes, /done indicates that you're done telling me your mistakes");
    $.sendMessage("/time sets the time in which you will be asked to state what you're grateful for. Please format your message like this '/time 7:00' or '/time 8:00 PM'");
  }
  get routes(){
    return {
      '/help': 'helpHandler'
    }
  }
}

//Time that the user will have a session begin
class TimeController extends TelegramBaseController{
  timeHandler($) {
    let text = $._message._text;
    let user_id = $._message._from._id;
    //Find the user who sent the message
    User.findOne({user_id:user_id},function(err, user){
      if(err || user === null){
        console.log(err);
      }else{
        if(text.split(' ').length == 1){
          console.log(user.time,"User time in seconds");
          let hours = Math.floor(user.time/(60*60));
          console.log(hours,"User hour");
          let remainder = user.time % (60*60);
          console.log(remainder,"User remainder in seconds");
          let minutes = Math.floor(remainder/60);
          console.log(minutes,"User minutes");
          let hoursString = ensureTwoDigits(hours);
          let minutesString = ensureTwoDigits(minutes);
          let time = hoursString + ":" + minutesString;
          $.sendMessage("You will be reminded to begin a session at " + time + " in 24-hour time");
        }else{
          //get the string after the /time part
          let time = Date.parse(text.substring(5));
          let hours = time.getHours();
          let minutes = time.getMinutes();
          //calculate the time in seconds since the start of the day
          user.time = convertHoursToSeconds(hours)+convertMinutesToSeconds(minutes);
          user.save();
          let minutesString = ensureTwoDigits(minutes);
          let hoursString = ensureTwoDigits(hours);
          //If the number of minutes is a single digit, add a 0 to the beginning
          $.sendMessage('The time you will be messaged at is now '+hoursString+":"+minutesString+" in 24-hour time as per your request");
        }
      }
    })
  }

  get routes(){
    return {
      '/time': 'timeHandler'
    }
  }
}

//What to do when the user first starts using it
class StartController extends TelegramBaseController{
  startHandler($){
    let user_id = $._message._from._id;
    let newUser = new User({user_id:user_id,status:COMPLETE,time:21*60*60});
    newUser.save(function(err){
      //if a document with this user_id already exists, start a session
      if(err){
        console.log(err);
        User.findOne({user_id:user_id}, function(err,user){
          user.status = GRATEFUL;
          user.save();
          $.sendMessage('What are you grateful for today?');
        })
      }else{
        console.log('new user added');
        $.sendMessage("Hey! I'll send you a message at 9 PM every day letting you know that you should state what you're grateful for");
        $.sendMessage("After you're done saying what you're grateful for, write /done and I'll ask what your mistakes were")
        $.sendMessage("When you're done telling me about your mistakes, write /done again to end our session")
        $.sendMessage("You can change what time I'll ask you at by writing something like '/time 9:00 AM' or '/time 9:00' (in 24-hour time)");
        $.sendMessage("Get help with /help");
      }
    });
  }

  get routes() {
    return {
      '/start': 'startHandler'
    }
  }
}

/*Class to handle when the user completes a section of a session or completes
the session itself*/
class DoneController extends TelegramBaseController{
  doneHandler($){
    let user_id = $._message._from._id;

    //get the user who sent the message
    User.findOne({user_id:user_id},function(err, user){
      //if the user hasn't started a session yet, start a session
      if(user.status === COMPLETE){
        $.sendMessage('Hi! What are you grateful for?');
        user.status = GRATEFUL;
        user.save();
      }
      //if the user is currently being grateful, switch to having them detail their mistakes
      else if(user.status === GRATEFUL){
        $.sendMessage("That's great. What were your mistakes?");
        user.status = MISTAKE;
        user.save();
      }
      //if the user is detailing their mistakes,end the session
      else if(user.status === MISTAKE){
        $.sendMessage('Okay, great talking to you!');
        user.status = COMPLETE;
        user.save();
      }
    });
  }
  get routes(){
    return {
      '/done': 'doneHandler'
    }
  }
}

//Handle anything not covered by the previous controllers
class NormalController extends TelegramBaseController{
  handle($){
    let user_id = $._message._from._id;

    User.findOne({user_id:user_id},function(err, user){
      if(user.status === GRATEFUL){
        let response = gratefulAcknowledgements[getRandomInt(0,gratefulAcknowledgements.length)] + " " +gratefulFollowups[getRandomInt(0,gratefulFollowups.length)];
        $.sendMessage(response);
      }else if(user.status === MISTAKE){
        let response = mistakeAcknowledgements[getRandomInt(0,mistakeAcknowledgements.length)] + " " + mistakeFollowups[getRandomInt(0,mistakeFollowups.length)];
        $.sendMessage(response);
      }else if(user.status === COMPLETE){
        $.sendMessage("If you would like to start a session. Please type /start");
      }
    });
  }
}

function convertHoursToSeconds(hours){
  return hours*60*60;
}

function convertMinutesToSeconds(minutes){
  return minutes*60;
}

/*Find any user times from now to five minutes from now and
send a message to those users. This method doesn't send a message at the exact
time that the user wants it but it should send it close enough that users
have no issue with that.
*/
function sendMessages(){
  console.log("Sending scheduled messages");
  let date = new Date();
  let currentHour = date.getHours();
  let currentMinutes = date.getMinutes();
  let currentSeconds = date.getSeconds();
  let currentTimeInSeconds = convertHoursToSeconds(currentHour) + convertMinutesToSeconds(currentMinutes) + currentSeconds;
  //5 minutes from current time
  let futureTimeInSeconds = currentTimeInSeconds + convertMinutesToSeconds(5);
  User.find({
    'time':{
      '$lt':futureTimeInSeconds,
      '$gt':currentTimeInSeconds
    }
  }, function(err,docs){
      if(err){
        console.log(err);
      }else{
        for(let i = 0;i < docs.length;i++){
          let doc = docs[i];
          tg.api.sendMessage(doc.user_id,"It's time. What are you grateful for today?");
          doc.status = GRATEFUL;
          doc.save();
        }
      }
  });
}

setInterval(sendMessages,convertMinutesToSeconds(5)*1000);

tg.router.
    when(['/start'], new StartController()).
    when(['/time'],new TimeController()).
    when(['/done'],new DoneController()).
    when(['/help'],new HelpController()).
    otherwise(new NormalController());

console.log("Start sending messages now!");
