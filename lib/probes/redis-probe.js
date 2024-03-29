'use strict';


var RedisMonitor = require('../monitors/redis-monitor').RedisMonitor;


var commands = [
    "append",
    "auth",
    "bgrewriteaof",
    "bgsave",
    "blpop",
    "brpop",
    "brpoplpush",
    "config",
    "dbsize",
    "debug",
    "decr",
    "decrby",
    "del",
    "discard",
    "echo",
    "exec",
    "exists",
    "expire",
    "expireat",
    "flushall",
    "flushdb",
    "get",
    "getbit",
    "getrange",
    "getset",
    "hdel",
    "hexists",
    "hget",
    "hgetall",
    "hincrby",
    "hkeys",
    "hlen",
    "hmget",
    "hmset",
    "hset",
    "hsetnx",
    "hvals",
    "incr",
    "incrby",
    "info",
    "keys",
    "lastsave",
    "lindex",
    "linsert",
    "llen",
    "lpop",
    "lpush",
    "lpushx",
    "lrange",
    "lrem",
    "lset",
    "ltrim",
    "mget",
    "monitor",
    "move",
    "mset",
    "msetnx",
    "multi",
    "object",
    "persist",
    "ping",
    "psubscribe",
    "publish",
    "punsubscribe",
    "quit",
    "randomkey",
    "rename",
    "renamenx",
    "rpop",
    "rpoplpush",
    "rpush",
    "rpushx",
    "sadd",
    "save",
    "scard",
    "sdiff",
    "sdiffstore",
    "select",
    "set",
    "setbit",
    "setex",
    "setnx",
    "setrange",
    "shutdown",
    "sinter",
    "sinterstore",
    "sismember",
    "slaveof",
    "smembers",
    "smove",
    "sort",
    "spop",
    "srandmember",
    "srem",
    "strlen",
    "subscribe",
    "sunion",
    "sunionstore",
    "sync",
    "ttl",
    "type",
    "unsubscribe",
    "unwatch",
    "watch",
    "zadd",
    "zcard",
    "zcount",
    "zincrby",
    "zinterstore",
    "zrange",
    "zrangebyscore",
    "zrank",
    "zrem",
    "zremrangebyrank",
    "zremrangebyscore",
    "zrevrange",
    "zrevrangebyscore",
    "zrevrank",
    "zscore",
    "zunionstore"
];


function RedisProbe(agent) {
  this.agent = agent;

  this.packages = ['redis'];
}
exports.RedisProbe = RedisProbe;



RedisProbe.prototype.attach = function(obj) {
  var self = this;

  if(obj.__nodetimeProbeAttached__) return;
  obj.__nodetimeProbeAttached__ = true;

  var logger = self.agent.logger;
  var proxy = self.agent.proxy;
  var profiler = self.agent.profiler;
  var counter = profiler.createSkipCounter();
  var metrics = profiler.createCallMetricsGroups();
  var type = 'Redis';


  var redisMonitor = new RedisMonitor(self.agent);
  redisMonitor.init(obj);


  proxy.after(obj, 'createClient', function(obj, args, ret) {
    var client = ret;

    redisMonitor.monitorServer(client.host, client.port);

    commands.forEach(function(command) {
      proxy.before(ret, command, function(obj, args) {
        var trace = profiler.stackTrace();
        var time = profiler.time(type, command);
        metrics.callStart(type, null, time);
        metrics.callStart(type, command, time);
        var params = args;

        if(command === 'auth' && args.length > 0) {
          redisMonitor.monitorServer(client.host, client.port, args[0]);
        }

        proxy.callback(args, -1, function(obj, args) {
          if(!time.done(proxy.hasError(args))) return;
          metrics.callDone(type, null, time);
          metrics.callDone(type, command, time);
          if(counter.skip(time)) return;

          var error = proxy.getErrorMessage(args);
          var sample = profiler.createSample();
          sample['Type'] = type;
          sample['Connection'] = {host: client.host, port: client.port};
          sample['Command'] = command;
          sample['Arguments'] = profiler.truncate(params);
          sample['Stack trace'] = trace;
          sample['Error'] = error;
          sample._group = type + ': ' + command;
          sample._label = type + ': ' + command;

          profiler.addSample(time, sample);
        });
      });
    });
  });
};

