'use strict';

const telegram = require('telegram-node-bot');
const TelegramBaseController = telegram.TelegramBaseController;
const tg = new telegram.Telegram(process.env.BGRAPHER_TOKEN);
const datejs = require('datejs');
const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const GRATEFUL = 'GRATEFUL';
const MISTAKE = 'MISTAKE';
const COMPLETE = 'COMPLETE';

mongoose.connect(process.env.MONGODB_URI);

let userSchema = new mongoose.Schema({
  user_id:{type:Number,required:true,unique:true,dropDups:true,index:true},
  status:{type:String,required:true},
  time:{type:Number,required:true}
},{id:false})
userSchema.plugin(uniqueValidator);

let User = mongoose.model('User', userSchema);

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

class TimeController extends TelegramBaseController{
  timeHandler($) {
    let text = $._message._text;
    let user_id = $._message._from._id;
    let time = Date.parse(text.substring(5));
    let hours = time.getHours();
    let minutes = time.getMinutes();

    User.findOne({user_id:user_id},function(err, user){
      if(err || user === null){
        console.log(err);
      }else{
        console.log(user)
        user.time = convertHoursToSeconds(hours)+convertMinutesToSeconds(minutes);
        user.save();
        $.sendMessage('The time you will be messaged at is now '+hours+":"+minutes+" in 24-hour time as per your request");
        console.log(user);
      }
    })

    console.log(hours);
    console.log(minutes);
  }

  get routes(){
    return {
      '/time': 'timeHandler'
    }
  }
}

class StartController extends TelegramBaseController{
  startHandler($){
    let user_id = $._message._from._id;
    console.log($);
    let newUser = new User({user_id:user_id,status:COMPLETE,time:21*60*60});
    newUser.save(function(err){
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

class DoneController extends TelegramBaseController{
  doneHandler($){
    let user_id = $._message._from._id;

    User.findOne({user_id:user_id},function(err, user){
      if(user.status === COMPLETE){
        $.sendMessage('Hi! What are you grateful for?');
        user.status = GRATEFUL;
        user.save();
      }else if(user.status === GRATEFUL){
        $.sendMessage("That's great. What were your mistakes?");
        user.status = MISTAKE;
        user.save();
      }else if(user.status === MISTAKE){
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

class NormalController extends TelegramBaseController{
  handle($){
    let user_id = $._message._from._id;

    User.findOne({user_id:user_id},function(err, user){
      if(user.status === GRATEFUL){
        $.sendMessage('Great! What else are you grateful for?');
      }else if(user.status === MISTAKE){
        $.sendMessage("I'm sorry to hear that. What other mistakes did you make today?");
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
        console.log(docs);
        for(let i = 0;i < docs.length;i++){
          let doc = docs[i];
          console.log(doc.user_id);
          tg.api.sendMessage(doc.user_id,"It's time. What are you grateful for today?");
          doc.status = GRATEFUL;
          doc.save();
        }
      }
  });
}

setTimeout(sendMessages,convertMinutesToSeconds(5)*1000);

tg.router.
    when(['/start'], new StartController()).
    when(['/time'],new TimeController()).
    when(['/done'],new DoneController()).
    when(['/help'],new HelpController()).
    otherwise(new NormalController())

console.log("Start sending messages now!");
