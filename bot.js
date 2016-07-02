let tg = require('telegram-node-bot')(process.env.BGRAPHER_TOKEN);
let datejs = require('datejs');
let mongoose = require('mongoose');
let uniqueValidator = require('mongoose-unique-validator');

mongoose.connect(process.env.MONGODB_URI);

let userSchema = new mongoose.Schema({
  id:{type:Number,required:true,unique:true,dropDups:true,index:true},
  status:{type:String,required:true},
  time:{type:Number,required:true}
})
userSchema.plugin(uniqueValidator);

let User = mongoose.model('User', userSchema);

tg.router.
    when(['ping'], 'PingController').
    when(['/start'], 'StartController').
    when(['/time'],'TimeController').
    when(['/done'],'DoneController').
    when(['/help'],'HelpController').
    otherwise('NormalController')

tg.controller('HelpController',function($){
  $.sendMessage("/start will begin a new session");
  $.sendMessage("/done can indicate that you're done being grateful if you are currently telling me what you're grateful for");
  $.sendMessage("If you're telling me your mistakes, /done indicates that you're done telling me your mistakes");
  $.sendMessage("/time sets the time in which you will be asked to state what you're grateful for. Please format your message like this '/time 7:00' or '/time 8:00 PM'");
})

tg.controller('TimeController', function($){
  let text = $.message.text;
  let id = $.user.id;
  let date = Date.parse(text.substring(5));
  let hours = date.getHours();
  let minutes = date.getMinutes();

  User.findOne({id:id},function(err, user){
    console.log(user)
    user.time = convertHoursToSeconds(hours)+convertMinutesToSeconds(minutes);
    user.save();
    console.log(user);
  })

  console.log(hours);
  console.log(minutes);
})

tg.controller('PingController', function($){
  console.log($);
    tg.for('ping', function(){
        $.sendMessage('pong');
    })
})

tg.controller('StartController',function($){
  let newUser = new User({id:$.user.id,status:'COMPLETE',time:21*60*60});
  newUser.save(function(err){
    if(err){
      console.log(err);
      User.findOne({id:$.user.id}, function(err,user){
        user.status = 'GRATEFUL';
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
});

tg.controller('DoneController',function($){
  let user_id = $.user.id;

  User.findOne({id:user_id},function(err, user){
    if(user.status === 'COMPLETE'){
      $.sendMessage('Hi! What are you grateful for?');
      user.status = 'GRATEFUL';
      user.save();
    }else if(user.status === 'GRATEFUL'){
      $.sendMessage("That's great. What were your mistakes?");
      user.status = 'MISTAKE';
      user.save();
    }else if(user.status === 'MISTAKE'){
      $.sendMessage('Okay, great talking to you!');
      user.status = 'COMPLETE';
      user.save();
    }
  });
});

tg.controller('NormalController',function($){
  let user_id = $.user.id;

  User.findOne({id:user_id},function(err, user){
    if(user.status === 'GRATEFUL'){
      $.sendMessage('Great! What else are you grateful for?');
    }else if(user.status === 'MISTAKE'){
      $.sendMessage("I'm sorry to hear that. What other mistakes did you make today?");
    }else if(user.status === 'COMPLETE'){
      $.sendMessage("If you would like to start a session. Please type /start");
    }
  });
})

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
  let usersToMessage = User.find().where('time').
  gt(currentTimeInSeconds).
  lt(futureTimeInSeconds).
  exec(function(err,docs){
    for(let doc in docs){
      tg.api.sendMessages(doc.id,"It's time! What are you grateful for today?");
      doc.status = 'GRATEFUL';
      doc.save();
    }
  });
}

setInterval(sendMessages,convertMinutesToSeconds(5)*1000);
