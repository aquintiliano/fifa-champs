#!/usr/bin/env node

const https = require('https');
const cheerioDOMLoader = require('cheerio');
const fs = require('fs');

const BASE_URL = 'https://www.fifaindex.com'
const FIFA_VERSION = 'fifa18_174';
const BASE_QUERY = 'SELECT * FROM htmlstring WHERE url="https://www.fifaindex.com/teams/{0}/{1}/?type={2}"';
const PARAMS = '&format=json&diagnostics=true&env=store://datatables.org/alltableswithkeys&callback=';

let jsonFile = {};

const LEAGUES_COUNTRY =  {
    'ALJ League' : 'Saudi Arabia',
    'Alka Superliga' : 'Denmark',
    'Allsvenskan' : 'Sweden',
    'Barclays PL' : 'England',
    'Bundesliga' : 'Germany',
    'Bundesliga 2' : 'Germany',
    'Camp. Scotiabank' : 'Chile',
    'Ekstraklasa' : 'Poland',
    'Eredivisie' : 'Netherlands',
    'FL Championship' : 'England',
    'Football League 1' : 'England',
    'Football League 2' : 'England',
    'Hyundai A-League' : 'Australia',
    'Japan J1 League (1)' : 'Japan',
    'K LEAGUE Classic' : 'South Korea',
    'LIGA Bancomer MX' : 'Mexico',
    'Liga Adelante' : 'Spain',
    'Liga BBVA' : 'Spain',
    'Liga Dimayor' : 'Colombia',
    'Liga NOS' : 'Portugal',
    'Liga do Brasil' : 'Brasil',
    'Ligue 1' : 'France',
    'Ligue 2' : 'France',
    'MLS' : 'United States',
    'Primera División' : 'Argentina',
    'Pro League' : 'Belgium',
    'Raiffeisen SL' : 'Switzerland',
    'Rest of World' : 'N/A',
    'Russian League' : 'Russia',
    'SSE Airtricity Lge' : 'Ireland',
    'Scottish Prem' : 'Scotland',
    'Serie A TIM' : 'Italy',
    'Serie B' : 'Italy',
    'Süper Lig' : 'Turkey',
    'Tippeligaen' : 'Norway',
    'Ö. Bundesliga' : 'Austria',
    'Women\'s National' : 'N/A',
    'Men\'s National' : 'N/A'
}

const TYPE_OF_TEAMS = {
    CLUBS : 0,
    INTERNATIONAL_TEAMS : 1,
    WOMEN_INTERNATIONAL : 2
}

/* Since this is a support script,
we should not be so hard on the no-console rule.*/
const Console = console;

/* Organize the number of asynchronous calls being executed at the same time
It will save the file only when all calls were requested, and finished */
let countDownAsynchronousCalls = {
    count : 0,
    lastCallWasMadeClubs : false,
    lastCallWasMadeInt : false,
    lastCallWasMadeWomen : false,
    lastCallWasMade : function (typeOfTeams) {
        /* Since International, Women and Clubs are separate things on the website,
        the requests are separated as well, so we need a control over which type of team were already finished
        and save the file only when all of them were done */
        switch (typeOfTeams) {
        case TYPE_OF_TEAMS.INTERNATIONAL_TEAMS:
            this.lastCallWasMadeInt = true;
            break;
        case TYPE_OF_TEAMS.WOMEN_INTERNATIONAL:
            this.lastCallWasMadeWomen = true;
            break;
        default:
            this.lastCallWasMadeClubs = true;
            break;
        }
    },
    check : function () {
        this.count--;
        if (this.count == 0) {
            this.calculate();
        }
    },
    calculate : function () {
        if (this.lastCallWasMadeClubs && this.lastCallWasMadeInt && this.lastCallWasMadeWomen) {
            /* This is saved to keep a list of odds of when a specific star will be selected
            A refactor on the way this is implemented will happen soon.
            */
            jsonFile['oddsForTypesAvailable'] = ['2.5', '4.0', '5.0', '3.0', '3.5', '4.5', '4.0', '0.5', 'WMN 4.5',
                'WMN 4.0', '4.5', 'INT 4.5', '1.0', 'INT 5.0', 'INT 4.0', '1.5', '5.0', '1.0', '4.5', '2.0', '5.0', '4.0'];
            fs.writeFile('resources/teamsFifa18.json', JSON.stringify(jsonFile, null, 2), function (err) {
                if (err) {
                    return Console.log(err);
                }
            });
        }
    }
};

function getImageFromTeam($collumn) {
    return BASE_URL + $collumn.find('img').attr('src');
}

function getTeamGeneralParam($collumn) {
    return $collumn.children('a').text();
}

function getTeamRatingParam($collumn) {
    return $collumn.children('span.rating').text();
}

function getTeamStars($collumn) {
    let wholeStar = $collumn.children('span.star').find('.fa-star').length * 1.0;
    let halfStar = $collumn.children('span.star').find('.fa-star-half-o').length / 2.0;
    return wholeStar + halfStar;
}

function getStringPerTeamType(typeOfTeam) {
    /* It will switch the "stars" name with the proper type of team: Women (WMN), International (INT) or Clubs */
    switch (typeOfTeam) {
    case TYPE_OF_TEAMS.INTERNATIONAL_TEAMS:
        return 'INT ';
    case TYPE_OF_TEAMS.WOMEN_INTERNATIONAL:
        return 'WMN ';
    default:
        return '';
    }
}

function getAttributesFromTeam($context, teamElem, jsonFile, typeOfTeams) {
    /* The variable "$" is passed here and on other functions in order to be able to use the cheerio context properly */
    let team = {};
    let teamsAttributes = teamElem.children('td');
    team.badgeImage = getImageFromTeam($context(teamsAttributes.get(0)));
    team.name = getTeamGeneralParam($context(teamsAttributes.get(1)));
    team.league = getTeamGeneralParam($context(teamsAttributes.get(2)));
    team.country = LEAGUES_COUNTRY[team.league];
    team.attack = getTeamRatingParam($context(teamsAttributes.get(3)));
    team.midfield = getTeamRatingParam($context(teamsAttributes.get(4)));
    team.defense = getTeamRatingParam($context(teamsAttributes.get(5)));
    team.overall = getTeamRatingParam($context(teamsAttributes.get(6)));

    Console.info('Processing ' + team.name + '...');

    let stars = getStringPerTeamType(typeOfTeams) + getTeamStars($context(teamsAttributes.get(7))).toFixed(1);

    if (jsonFile[stars] == null) {
        jsonFile[stars] = [];
    }

    if (team.name != 'Free Agents') {
        jsonFile[stars].push(team);
    }
}

function getTeams($context, jsonFile, typeOfTeams) {
    let $teamsTable = $context('table tbody');
    $teamsTable.children('tr').each(function (i, elem) {
        getAttributesFromTeam($context, $context(elem), jsonFile, typeOfTeams);
    });
}

function formatString(...args) {
    const params = Reflect.apply(Array.prototype.slice, args, []);
    return BASE_QUERY.replace(/{(\d+)}/g, function (match, number) {
        return typeof params[number] == 'undefined' ? match : params[number];
    });
}

function requestTeamPage(version, page, typeOfTeams) {
    let formattedQuery = formatString(version, page, typeOfTeams);
    let url = 'https://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(formattedQuery) + PARAMS;
    let data = [];
    https.get(url, function (res) {
        if (res.statusCode == 200) {
            countDownAsynchronousCalls.count++;
            res.on('data', (chunk) => {
                data.push(chunk);
            });

            res.on('end', () => {

                // Remove any \n and escaped \ that is gotten from the request.
                data = Buffer.concat(data).toString().replace(/\\n/g, '').replace(/\\/g, '');

                // Get Current Page From HTML inside Cheerio's context.
                let $context = cheerioDOMLoader.load(data);

                // Where the magic happens
                getTeams($context, jsonFile, typeOfTeams);

                /* If this element exists, then has a next page for the current type of team.
                Condition to stop the recursive algorithm is here.
                Mainly "When it does not have more pages".
                */
                let $hasNextPage = ($context('li.next').not('.disabled').children('a').text().localeCompare('Next Page') == 0);
                if ($hasNextPage) {
                    requestTeamPage(FIFA_VERSION, ++page, typeOfTeams);
                } else {
                    countDownAsynchronousCalls.lastCallWasMade(typeOfTeams);
                }

                countDownAsynchronousCalls.check();
            });
        }

    }).on('error', function (err) {
        Console.log('Got error: ' + err.message);
    });
}

/* Call the functions for Clubs (typeOfTeam=0),
International Teams (typeOfTeam=1),
and Women International (typeOfTeam=2) */
requestTeamPage(FIFA_VERSION, 1, TYPE_OF_TEAMS.CLUBS);
requestTeamPage(FIFA_VERSION, 1, TYPE_OF_TEAMS.INTERNATIONAL_TEAMS);
requestTeamPage(FIFA_VERSION, 1, TYPE_OF_TEAMS.WOMEN_INTERNATIONAL);
