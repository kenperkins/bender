# bender

Bender is a server and service management app from Clipboard

## Usage

Presently, bender is only available from the command line.

```
./lib/bender-cli
```

```
Bender
  The server/service management app from Clipboard


  Usage: bender-cli [options]

  Options:

    -h, --help               output usage information
    -V, --version            output the version number
    -l, --list <type>        List entities by type. Options are [server|environment|provider]
    -c, --create <type>      Create entity. Options are [server|environment|provider]
    -d, --destroy <type>     Delete an entity. Options are [server|environment|provider]
    --log <level>            Configure log level. Options are [debug|versbose|info|warn|error]
    --whitelist <interface>  Whitelist all servers on the target interface
    --reset-database         Forcefully Reset the Bender database
```

#### Author: [Ken Perkins](http://github.com/kenperkins)
