"use strict"

const Promise = require("bluebird");
const errors = require('./../errors');
const util = require('./../utils');
const Mongoose = require('Mongoose');
const ObjectId = Mongoose.Types.ObjectId;

const document = require('./../models/match');

class MatchController {

	constructor(mongo) {
		this.mongo = mongo;
	}
	
	getAll() {
		return this.mongo.selectAll(document).populate("player1 player2 player3 player4").exec().then((matches) => {
			return this._prepareToSend(matches);
		});
	}

	getById(id) {
		return this.mongo.selectById(document, id).populate("player1 player2 player3 player4").exec().then((match) => {
			return this._prepareToSend(match);
		});
	}

	getByCriteria(criteria) {

		if (criteria.offset && criteria.limit) {
			var limit = parseInt(criteria.limit);
			criteria.limit = undefined;
			var offset = parseInt(criteria.offset);
			criteria.offset = undefined;
			return this.mongo.selectByCriteriaLimitOffset(document, criteria, limit, offset).populate("player1 player2 player3 player4").exec();
		} else {
			return this.mongo.selectByCriteria(document, criteria).populate("player1 player2 player3 player4").exec();
		}
	}

	getByChampionship(championshipId) {
		var id = new ObjectId(championshipId)
		return this.mongo.selectByCriteria(document, {championship: id}).populate("player1 player2 player3 player4").exec().then((match) => {
			return this._prepareToSend(match);
		});
	}

	insert(match) {
		return this.mongo.insert(new document(match)).then((matchSaved) => {
			return this.getById(matchSaved._id);
		}).bind(this).then((matchSaved) => {
			return this._prepareToSend(matchSaved);
		});
	}

	update(id, championship) {
		return this.mongo.update(document, id, championship).then((matchSaved) => {
			return this.getById(matchSaved._id);
		}).bind(this).then((matchSaved) => {
			return this._prepareToSend(matchSaved);
		});
	}

	delete(id) {
		return this.mongo.delete(document, id).then((result) => {
			return result;
		});
	}

	_prepareToSend(matchSaved) {
		if (Array.isArray(matchSaved)) {
			for (var match in matchSaved) {
				matchSaved[match].date = util.formatDate(new Date(matchSaved[match].date));
			}
			return matchSaved;
		}
		matchSaved.date = util.formatDate(new Date(matchSaved.date));
		return matchSaved;
	}
};

module.exports = MatchController;