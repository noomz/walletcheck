var sha1 = require('sha1');
var randtoken = require('rand-token');
var express = require('express'),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose'),
    multer = require('multer');

var config = require('./config');
var app = express();

app.use(bodyParser.raw());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer());

mongoose.connect('mongodb://localhost/walletcheck');

var EntrySchema = mongoose.Schema({
    type: String,
    description: String,
    amount: Number,
    payment_type: String,
    currency: {
        type: String,
        default: 'baht'
    },
    occured: Date,
    created: Date,
    updated: Date,
    tags: Array
});

EntrySchema.pre('save', function (next) {
    var now = new Date();
    this.updated = now;
    if (!this.created) {
        this.created = now;
    }
    if (!this.occured) {
        this.occured = now;
    }
    this.type = (this.type === "income") ? "income" : "expense";
    this.tags = this.tags || []
    if (this.tags.length === 0) {
        this.tags.push(this.type);
    }
    next();
});

var Entry = mongoose.model('entry', EntrySchema);

var UserSchema = mongoose.Schema({
    username: String,
    password: String,
    token: String
});
var User = mongoose.model('user', UserSchema);

app.use(function (req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set("Access-Control-Allow-Headers", "X-Requested-With");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE');
    next();
});

// Authenticate
app.use(function (req, res, next) {
    if (req.method === 'OPTIONS') return next();
    if (req._parsedUrl.pathname === '/api/login') return next();

    if (!req.query.token) {
        return res.status(401).end();
    }

    User.findOne({ token: req.query.token }).exec(function (err, user) {
        if (err) return res.status(500).end();
        if (!user) return res.status(401).end();

        next();
    });
});

app.post('/api/login', function (req, res, next) {
    if (!req.body.username || !req.body.password ||
        !req.body.username.trim() || !req.body.password.trim()) {
        return res.status(401).end();
    }

    User
    .findOne({ username: req.body.username, password: sha1(req.body.password) })
    .exec(function (err, user) {
        if (err) return res.status(500).end();
        if (!user) return res.status(401).end();

        var token = randtoken.generate(16);
        if (!user.token) {
            user.token = token;
            user.save(function (err) {
                res.send({
                    username: user.username,
                    token: user.token
                });
            });
        }
        else {
            res.send({
                username: user.username,
                token: user.token
            });
        }
    });
});

app.get('/api/entries', function (req, res) {
    Entry.find().sort('-occured').sort('-created').exec(function (err, entries) {
        if (err) return res.status(500).end();
        res.send(entries);
    });
});

app.get('/api/entries/:entry_id', function (req, res) {
    res.send(req.entry);
});

app.post('/api/entries', function (req, res) {
    var entry = new Entry(req.body);
    entry.save(function (err) {
        if (err) return res.status(500).end();
        res.send(entry);
    });
});

app.param('entry_id', function (req, res, next, entry_id) {
    Entry.findOne({ _id: entry_id }).exec(function (err, entry) {
        if (err) return res.status(500).end();
        if (!entry) return res.status(404).end();

        req.entry = entry;
        next();
    });
});

app.put('/api/entries/:entry_id', function (req, res) {
    var entry = req.entry;

    if (req.body.type) entry.type = req.body.type;
    if (req.body.occured) entry.occured = req.body.occured;
    if (req.body.amount) entry.amount = req.body.amount;
    if (req.body.description) entry.description = req.body.description;
    if (req.body.payment_type) entry.payment_type = req.body.payment_type;
    if (req.body.currency) entry.currency = req.body.currency;
    if (req.body.tags) entry.tags = req.body.tags;

    entry.save(function (err, updatedEntry) {
        if (err) return res.status(500).end();

        res.send(updatedEntry);
    });
});

app.delete('/api/entries/:entry_id', function (req, res) {
    var entry = req.entry;
    entry.remove(function (err) {
        if (err) return res.status(500).end();
        res.send();
    });
});

app.listen(3000);
