var express = require("express"),
    app = express(),
    bodyParser  = require("body-parser"),
    methodOverride = require("method-override"),
    vo = require('vo');


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride());



var Nightmare = require('nightmare');
    
var router = express.Router();

var click;
var recipe;
var pageNum;
var login_recipe;
var selector; 
var cookies;
var nightmare;

function *login() {
  try {
    if (cookies) {
        nightmare.goto(login_recipe['goto']).cookies.set(cookies);
    } else {
        nightmare.goto(login_recipe['goto']);
    }
    var logged_in = yield nightmare.evaluate( function (evaluate){
      var val = false;
      if (document.querySelector(evaluate['obj'])){
        if (document.querySelector(evaluate['obj'])[evaluate['attr']]==evaluate['value']){
            val = true;
        } else {
            console.log('Error in check login val:'+document.querySelector(evaluate['obj'])[evaluate['attr']]+' /// expected:'+evaluate['value']);
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
        });
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
    return {logged_in: logged_in, message: details};
  } catch (e){
    throw new Error(e.message+' ('+selector+')');
  }
}

function *source() {
    try {
        nightmare.goto(recipe)
            .wait();
        if(click){
            nightmare.click(click)
                .wait("html");
        }
        var r = yield nightmare.evaluate(function() {
            return document.getElementsByTagName('html')[0].innerHTML;
        });
        // console.log(r);
        return r;
    } catch(e){
        throw new Error(e.message+' ('+selector+')');
    }
}

function *run() {
    try {
        selector = 'goto page';
        console.log(selector + ' ' + recipe['goto']);
        nightmare.goto(recipe['goto']);
        recipe['steps'].forEach(function(step){
            selector = 'steps: ' + JSON.stringify(step);
            if( typeof step['value'] === "object" ){
                nightmare[step['action']](step['value'][0],step['value'][1]); 
            } else {
                nightmare[step['action']](step['value']);              
            }
        });

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
    } finally {
       yield nightmare.end();
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

router.post('/source', function(req,res){
   if (req.body.url) {
    try {
        nightmare = Nightmare({
            show:false,
            'ignore-certificate-errors': true,
            'webPreferences': {
                partition: 'persist:source'
            }        
        });
        pageNum = req.body.pageNum;
        recipe = req.body.url;
        click = req.body.click;
        vo(source)(function(err,result){
            if(err) throw new Error(err);
            res.send(result);
        });
    } catch (e){
        throw new Error(e);
    } finally {
        nightmare.end();
    }
   } 
});

router.post('/', function(req,res) {
    var util = require('util');

    console.log(util.inspect(req.body, {showHidden: false, depth: null}));

    var logged_in = false;
   if (login_recipe = req.body.login) {
       try {
            selector = 'Creating Nightmare instance';
            cookies = req.body.cookies;
            var nm_opts = {
                show:true,
                waitTimeout: 3000,
                'ignore-certificate-errors': true
            };
            // if (!cookies){
                // nm_opts['paths'] = { userData: '/Users/matrix/Proyectos/pulpou/pulpou-reports/pulpou-nightmare/userData/'+login_recipe['isLoggedIn']['value']};
                nm_opts['paths'] = { userData: '/app/userData/'+login_recipe['isLoggedIn']['value']};
            // }
            nightmare = Nightmare(nm_opts);
            // vo(login)(function(err, result) {
                // if (err){
                    // res.send({status: 'error', message: err});
                // } else {
                    // logged_in = result.logged_in;
                    logged_in = true;
                    recipe = req.body.recipe;
                    if (logged_in && recipe){
                        if (recipe.goto && recipe.evaluate && recipe.response){
                            try {
                                // console.log('cookies:');
                                // nightmare.cookies.get({ url: null },function(e,c){
                                //     console.log(JSON.stringify(c));                                
                                // });
                                vo(run)(function(err, result) {
                                    try{
                                        if (err) res.status(400).send(err);
                                        if (result){
                                            jsResult = {}
                                            jsResult[recipe.response.success.key] = recipe.response.success.message
                                            res.send(jsResult);
                                        } else {
                                            jsResult = {}
                                            jsResult[recipe.response.fail.key] = recipe.response.fail.message
                                            throw new Error(jsResult+' ('+selector+')');
                                        }                                        
                                    } catch(err) {
                                        throw new Error(err.message);
                                    } 
                                });             
                            } 
                            catch(err) {
                                throw new Error(err.message+' ('+selector+')');
                            }
                        } else {
                            throw new Error(result);      
                        }
                    } else {
                        throw new Error(result);
                    }   
            //     }
            // });
       }
       catch(err){
           err.details = selector;
           err.status = 'Error';
           nightmare.end();
           res.status(400).send(err);
       }
   }
});

app.use(router);

var server = app.listen(8889, function() {
  console.log("NightmareJS webservice running on port 8889");
});