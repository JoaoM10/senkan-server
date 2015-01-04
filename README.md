Senkan Server
=============

Node.js server for Senkan.

## Deploy

First, start by download the repository.
```
$ git clone https://github.com/JoaoM10/senkan-server.git
```

Then, you need to create the database (MySQL). Run the following command on MySQL shell, on the repo dir:
```
mysql> source db.sql
```

You may need to configure your MySQL credentials. Just change the corresponding lines on senkan.js.

Now, you can start the server. Run this commands in the main directory of the server:
```
$ npm update
$ node senkan <port>
```

Note: `npm update` is only need on the first time.

## License

This code is free to use under the terms of the MIT license.
