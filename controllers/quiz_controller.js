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

//GET /quizzes/randomplay
exports.randomplay = function (req, res, next) {

    var answer = req.query.answer || '';
    if(!req.session.p52 || !req.session.p52.yaPreguntadas){
	req.session.p52 = { yaPreguntadas : [-1] }; //creo un nuevo atributo que es un array con las ya preguntadas
    }

    models.Quiz.count({where : {'id': {$notIn: req.session.p52.yaPreguntadas}}}) //me da el numero de preguntas que no he hecho, las que me quedan por responder
    .then(function (numNoPreguntadas){
	var aleatoria = Math.floor(Math.random()*numNoPreguntadas); //num entre 0 y las que me quedan por responder 
	return models.Quiz.findAll({
		limit: 1, //para que me devuelva solo una
		offset: aleatoria, //que me de el numero del array que he calculado aleatoriamente 
		where:  {'id': {$notIn: req.session.p52.yaPreguntadas}} //para que busque solo entre las que me quedan, no las he hecho
	});
    })
    .then(function (arrayQuiz){ //array con la siguiente pregunta a hacer
	if(arrayQuiz.length === 0){ //si no hay ninguna es que ya he respondido a todas 
 		var score = req.session.p52.yaPreguntadas.length-1;
		delete req.session.p52.yaPreguntadas;
		res.render('quizzes/random_nomore', { score: score });

	} else {
		res.render('quizzes/random_play', { 
			score : req.session.p52.yaPreguntadas.length -1,
			quiz: arrayQuiz[0]
		});
	}
    })
    .catch(function (error) {
	req.flash('error', 'Error al buscar los Quiz: ' + error.message);
        next(error);
    });
};

//GET /quizzes/randomcheck/:quizId?answer=respuesta
exports.randomcheck = function (req, res, next) {

    var answer = req.query.answer || '';
    var result = answer.toLowerCase().trim() === req.quiz.answer.toLowerCase().trim();
    var score = 0;
    if(result){	
	req.session.p52.yaPreguntadas.push(req.quiz.id);
	score= req.session.p52.yaPreguntadas.length-1;
    } else {
	score= 0;
	delete req.session.p52.yaPreguntadas;
    }
	

    res.render('quizzes/random_result', {
	score: score,
	answer: answer,
	result: result,
	quiz: req.quiz
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
