var models = require("../models");
var Sequelize = require('sequelize');

var paginate = require('../helpers/paginate').paginate;



// Autoload el quiz asociado a :quizId
exports.load = function (req, res, next, quizId) {

    models.Quiz.findById(quizId)
    .then(function (quiz) {
        if (quiz) {
            req.quiz = quiz;
            next();
        } else {
            throw new Error('No existe ningún quiz con id=' + quizId);
        }
    })
    .catch(function (error) {
        next(error);
    });
};


// GET /quizzes
exports.index = function (req, res, next) {

    var countOptions = {};

    // Busquedas:
    var search = req.query.search || '';
    if (search) {
        var search_like = "%" + search.replace(/ +/g,"%") + "%";

        countOptions.where = {question: { $like: search_like }};
    }

    models.Quiz.count(countOptions)
    .then(function (count) {

        // Paginacion:

        var items_per_page = 10;

        // La pagina a mostrar viene en la query
        var pageno = parseInt(req.query.pageno) || 1;

        // Crear un string con el HTML que pinta la botonera de paginacion.
        // Lo añado como una variable local de res para que lo pinte el layout de la aplicacion.
        res.locals.paginate_control = paginate(count, items_per_page, pageno, req.url);

        var findOptions = countOptions;

        findOptions.offset = items_per_page * (pageno - 1);
        findOptions.limit = items_per_page;

        return models.Quiz.findAll(findOptions);
    })
    .then(function (quizzes) {
        res.render('quizzes/index.ejs', {
            quizzes: quizzes,
            search: search
        });
    })
    .catch(function (error) {
        next(error);
    });
};


// GET /quizzes/:quizId
exports.show = function (req, res, next) {

    res.render('quizzes/show', {quiz: req.quiz});
};


// GET /quizzes/new
exports.new = function (req, res, next) {

    var quiz = {question: "", answer: ""};

    res.render('quizzes/new', {quiz: quiz});
};


// POST /quizzes/create
exports.create = function (req, res, next) {

    var quiz = models.Quiz.build({
        question: req.body.question,
        answer: req.body.answer
    });

    // guarda en DB los campos pregunta y respuesta de quiz
    quiz.save({fields: ["question", "answer"]})
    .then(function (quiz) {
        req.flash('success', 'Quiz creado con éxito.');
        res.redirect('/quizzes/' + quiz.id);
    })
    .catch(Sequelize.ValidationError, function (error) {

        req.flash('error', 'Errores en el formulario:');
        for (var i in error.errors) {
            req.flash('error', error.errors[i].value);
        }

        res.render('quizzes/new', {quiz: quiz});
    })
    .catch(function (error) {
        req.flash('error', 'Error al crear un Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/edit
exports.edit = function (req, res, next) {

    res.render('quizzes/edit', {quiz: req.quiz});
};


// PUT /quizzes/:quizId
exports.update = function (req, res, next) {

    req.quiz.question = req.body.question;
    req.quiz.answer = req.body.answer;

    req.quiz.save({fields: ["question", "answer"]})
    .then(function (quiz) {
        req.flash('success', 'Quiz editado con éxito.');
        res.redirect('/quizzes/' + req.quiz.id);
    })
    .catch(Sequelize.ValidationError, function (error) {

        req.flash('error', 'Errores en el formulario:');
        for (var i in error.errors) {
            req.flash('error', error.errors[i].value);
        }

        res.render('quizzes/edit', {quiz: req.quiz});
    })
    .catch(function (error) {
        req.flash('error', 'Error al editar el Quiz: ' + error.message);
        next(error);
    });
};


// DELETE /quizzes/:quizId
exports.destroy = function (req, res, next) {

    req.quiz.destroy()
    .then(function () {
        req.flash('success', 'Quiz borrado con éxito.');
        res.redirect('/quizzes');
    })
    .catch(function (error) {
        req.flash('error', 'Error al editar el Quiz: ' + error.message);
        next(error);
    });
};


// GET /quizzes/:quizId/play
exports.play = function (req, res, next) {

    var answer = req.query.answer || '';

    res.render('quizzes/play', {
        quiz: req.quiz,
        answer: answer
    });
};

// GET /quizzes/randomplay
exports.randomPlay = function (req, res, next) {

        if(!req.session.resolved){
             req.session.resolved = [ -1];
        } // hay que crearlo o vale ocn la sentencia used?

        //Comprobamos que el array de preguntas propuestas no está vacio
        var used = req.session.resolved.length ? req.session.resolved: [-1];

        //Compruebo que el id random que paso no ha sido ya pasado y resuelto el quiz por el usuario
        var whereOpt =  {id:{$notIn: used}};

        models.Quiz.count({where: whereOpt})
            .then(function(c){ // c es el numero de preguntas que me quedan
                // numero aleatorio entre 0 y el numero de respuestas que me quedan (sin incluir)
                var randomNumber = Math.floor(Math.random()*c);

                // la promesa1 devuelve array_quizzes (realmente es 1) a la promesa2
                return models.Quiz.findAll({where:whereOpt,limit:1, offset:randomNumber}) // array_quizzes
            })
            .then(function (array_quizzes) {
                if (array_quizzes.length ==0){ // Si ya se han mostrado todas las preguntas de la DB
                    res.render('quizzes/random_nomore',{
                        score: req.session.resolved.length -1
                    })
                }

                else{
                    res.render('quizzes/random_play',{
                        quiz: array_quizzes[0],
                        score: req.session.resolved.length -1
                    })
                }
            })

        ////////////////////////////////////

    // // Id random entre 0 y el numero de preguntas totales en la DB
    // var randomId = Math.random()* models.Quiz.count();
    //
    // //Comprobamos que el array de preguntas propuestas no está vacio
    // var used = req.session.randomplay.resolved.length ? req.session.randomplay.resolved: [-1];
    //
    // //Compruebo que el id random que paso no ha sido ya pasado y resuelto el quiz por el usuario
    // var whereOpt =  {id:{$notIn: used}};
    //
    // // Añado el id random elegido al array de preguntas propuestas para no repetirla
    //         req.session.randomplay.resolved.id;
    //
    // //Muestro la pagina con la pregunta aleatoria
    // res.render('quizzes/random_play', {
    //     quiz: models.Quiz.findAll({where:whereOpt},1),
    //     score: req.session.randomplay.resolved.length
    // });

    //}
};


// GET  /quizzes/randomcheck/:quizId?answer=respuesta
exports.randomCheck = function (req, res, next) {
n
    var answer = req.query.answer || "";

    var result = answer.toLowerCase().trim() === req.quiz.answer.toLowerCase().trim();

    // Añado el id al array de preguntas acertadas
    req.session.resolved.push(req.param.quizId);


    res.render('quizzes/random_result', {
        quiz: req.quiz,
        result: result,
        answer: answer,
        score: req.session.resolved.length-1
    });
};


// GET /quizzes/:quizId/check
exports.check = function (req, res, next) {

    var answer = req.query.answer || "";

    var result = answer.toLowerCase().trim() === req.quiz.answer.toLowerCase().trim();

    res.render('quizzes/result', {
        quiz: req.quiz,
        result: result,
        answer: answer
    });
};
