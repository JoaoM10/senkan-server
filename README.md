Senkan Server
=============

Node.js server for Senkan.


                                     # #  ( )
                                  ___#_#___|__
                              _  |____________|  _
                       _=====| | |            | | |==== _
                 =====| |.---------------------------. | |====
    \-------------------'   .  .  .  .  .  .  .  .   '--------------->
     \                         SENKAN    SERVER                    /
      \___________________________________________________________/


## Deploy

First, start by download the repository.
```
$ git clone https://github.com/JoaoM10/senkan-server.git
```

Then, you need to create the database (MySQL). Run the following command on MySQL shell, on the server's main directory:
```
mysql> source db.sql
```

You may need to configure your MySQL credentials. Just change the corresponding lines on senkan.js.

Now, you can start the server. Run this commands in the main directory of the server:
```
$ npm update
$ node senkan <port>
```

Note: `npm update` is only needed on the first time.

You can also use `forever` to relauch the server if it stops unexpectedly:
```
$ forever start -s -l logs.log -o logs.out -e logs.err senkan.js
```

## License

This code is free to use under the terms of the MIT license.
