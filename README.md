What Does This Do?
====================
This is a chatbot meant to promote personal reflection by asking you to think
about what you're grateful for as well as what your mistakes for the day are.
You can chat with it [here](https://telegram.me/Bgrapher_Bot).
How Do I Install It On My Computer?
==================
First, you have to get a Telegram bot token from
[Botfather](https://telegram.me/BotFather). Then, get access to a
MongoDB instance. I recommend [MongoLab](https://mlab.com/). Once you have
both of those complete, please set your environment variables as follows.
```Shell
export MONGODB_URI="Connection URI here"
export BGRAPHER_TOKEN="Telegram bot token here"
```
Once you have that down, just go ahead and run the following commands.
```Shell
git clone https://github.com/WaldoHatesYou/bgrapher.git
npm install
npm start
```
License
===================
This project is licensed under the **MIT** license.
