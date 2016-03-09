var express = require("express"),
    app = express(),
    bodyParser  = require("body-parser"),
    methodOverride = require("method-override");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride());

var Nightmare = require('nightmare');
    
var router = express.Router();

var vo = require('vo');

var recipe;
var login_recipe;
var selector; 
var nightmare;

function *login() {
  try {
    nightmare.goto(login_recipe['goto']);
    var logged_in = yield nightmare.evaluate( function (evaluate){
      var val = false;
      if (document.querySelector(evaluate['obj'])){
        if (document.querySelector(evaluate['obj'])[evaluate['attr']]==evaluate['value']){
            val = true;
        }
      }
      return val;
    }, login_recipe['isLoggedIn']);
    if( !logged_in ){
        var details = '';
        selector = 'login steps';
        login_recipe['login_steps'].forEach(function(step){
            selector = 'login steps: ' + JSON.stringify(step);
            if( typeof step['value'] === "object" ){
                nightmare[step['action']](step['value'][0],step['value'][1]); 
            } else {
                nightmare[step['action']](step['value']);      
            }
        })
        logged_in = yield nightmare.evaluate(function (evaluate) {
            var val = false;
            selector = 'check login';
            if (document.querySelector(evaluate['obj'])){
                if (document.querySelector(evaluate['obj'])[evaluate['attr']]==evaluate['value']){
                    val = true;
                } else {
                    details = 'Value of attribute '+evaluate['attr']+' in selector '+evaluate['obj']+' mismatched. '+document.querySelector(evaluate['obj'])[evaluate['attr']]+'!='+evaluate['value'];                
                }
            } else {
                details = 'Selector '+evaluate['obj']+' not found. ';
            }
            return val;
        },login_recipe['isLoggedIn']);
    }
    return {logged_in: logged_in, details: details};
  } catch (e){
    throw new Error(e.message+' ('+selector+')');
  }
}

function *run() {
    try {
        selector = 'goto page'
        nightmare.goto(recipe['goto']);
        recipe['steps'].forEach(function(step){
            selector = 'steps: ' + JSON.stringify(step);
            if( typeof step['value'] === "object" ){
                nightmare[step['action']](step['value'][0],step['value'][1]); 
            } else {
                nightmare[step['action']](step['value']);              
            }
        })

        var result = yield nightmare.evaluate(function (evaluate) {
            var val = false;
            selector = 'evaluate: ' + JSON.stringify(evaluate);

            if (document.querySelector(evaluate['obj'])){
                if (document.querySelector(evaluate['obj'])[evaluate['attr']]==evaluate['value']){
                    val = true;
                }
            }
            return val;
        },recipe['evaluate']);
        
        return result;
    } catch (e){
        throw new Error(e.message+' ('+selector+')');
    }

}

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

router.get('/', function(req, res) {
       res.send("Hello "+req.query.nombre+"!");   
});

router.post('/', function(req,res) {
   var logged_in = false;
   if (login_recipe = req.body.login) {
       try {
            selector = 'Creating Nightmare instance';
            nightmare = Nightmare({
                show:true,
                waitTimeout: 23000,
                'ignore-certificate-errors': true,
                'webPreferences': {
                    partition: 'persist:'+login_recipe['isLoggedIn']['value']
                }        
            });

            vo(login)(function(err, result) {
                if (err){
                    res.send({status: 'error', details: err});
                } else {
                    logged_in = result.logged_in;
                    recipe = req.body.recipe
                    if (logged_in && recipe){
                        if (recipe.goto && recipe.evaluate){
                            try {
                                vo(run)(function(err, result) {
                                    if (err) res.send(err);
                                    res.send(result);
                                });             
                            } 
                            catch(err) {
                                res.send(err);
                            }
                        } else {
                            res.send(result);       
                        }
                    } else {
                        res.send(result);
                    }   
                }
                nightmare.end();
            });
       }
       catch(err){
           err.details = selector;
           err.status = 'Error';
           res.send(err);
       }
   }
});

app.use(router);

var server = app.listen(8889, function() {
  console.log("NightmareJS webservice running on port 8889");
});