/*
 * So, you’ve stumbled upon the Twitter Interaction Analysis project.
 * 
 * Copyright (C) 2024, @Sejindoesart – because credit where credit is due.
 *
 * This bad boy is free software: feel free to redistribute it, tweak it, or do whatever
 * else you want under the terms of the GNU General Public License as laid out by
 * those fine folks at the Free Software Foundation – either version 3 of the License,
 * or (if you’re feeling adventurous) any later version.
 *
 * Now, while this code might look shiny and promising, it’s provided AS-IS, with zero
 * guarantees. That means no promises of it being useful, fit for any particular purpose, 
 * or even not blowing up in your face. You’ve been warned.
 *
 * If you’re the kind of person who reads licenses (and let’s be real, you probably aren’t),
 * you should have received a copy of the GNU General Public License along with this program.
 * If not, head over to <https://www.gnu.org/licenses/> and enlighten yourself.
 */

const express = require('express');
const session = require('express-session');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();
const NodeCache = require("node-cache");
const myCache = new NodeCache({ stdTTL: 600 }); // We’ll pretend the data is fresh for 10 minutes. Why? Because who likes waiting?

const app = express();
const port = process.env.PORT || 3155; // Either the environment knows what's up, or we're going with my favorite number: 3155.

// If you’re hiding behind a proxy like a paranoid spy, tell Express to trust it.
app.set('trust proxy', 1);

// Let’s not let the party animals hit our server too hard. 100 requests per 15 minutes should keep things civilized.
const rateLimit = require("express-rate-limit");
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes. Long enough to finish a cup of coffee.
  max: 100, // That’s enough for anyone. No more, no less.
  standardHeaders: true, // Because we’re fancy like that.
  legacyHeaders: false, // Time to ditch the old ways.
});
app.use("/analyze-interactions", apiLimiter); // Locking down this route like it’s the crown jewels.

// Let’s write every single request to a log file. For posterity. Or paranoia.
const accessLogStream = fs.createWriteStream(__dirname + '/access.log', { flags: 'a' });
app.use((req, res, next) => {
    const timestamp = new Date().toISOString(); // Time of death... I mean, request.
    const logMessage = `${timestamp} - ${req.method} ${req.url} - ${req.headers['x-custom-auth']}`; // This is what happened.
    console.log(logMessage); // Echo it out, so we all know what just went down.
    accessLogStream.write(logMessage + '\n'); // And store it. Because we might want to read it again. Someday.
    next();
});

// Tell browsers to keep their noses out of sensitive data. No caching allowed. None.
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private'); // Forcing the browser to forget everything it ever knew.
    res.set('Pragma', 'no-cache'); // Just in case the browser didn’t get the first memo.
    res.set('Expires', '0'); // The past is dead, don’t even try to go back.
    next();
});

// Session management. Because some things are too precious to lose, like your secure cookies.
app.use(session({
    secret: process.env.SESSION_SECRET, // Don’t let anyone know your secret. Except everyone who has access to this environment.
    resave: false, // Don’t save the session if it hasn’t changed. Let’s not be wasteful.
    saveUninitialized: true, // Save that session, even if we don’t need it yet. Better safe than sorry.
    cookie: { secure: 'auto', httpOnly: true, sameSite: 'lax' } // Cookies are like cats. They’re best when they stay where they’re supposed to.
}));

// Serving static files from the “public” directory. Because everyone likes free stuff.
app.use(express.static('public'));

// Load Twitter API credentials from environment variables. Because hardcoding is for amateurs.
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const CALLBACK_URL = process.env.TWITTER_CALLBACK_URL;

// OAuth 2.0 Authorization endpoint for Twitter login. Because who doesn’t want to be famous?
app.get('/auth/twitter', (req, res) => {
    const state = crypto.randomBytes(32).toString('hex'); // Randomly generated gibberish. The best kind of protection.
    const codeVerifier = crypto.randomBytes(32).toString('hex'); // More gibberish, but this one is important for the handshake.
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); // SHA-256: because Twitter loves to make things complicated.

    req.session.codeVerifier = codeVerifier; // Store the code verifier in the session. We’ll need it later.
    req.session.state = state; // And the state too. Can’t forget that.

    // Redirect to Twitter’s OAuth 2.0 authorization endpoint. Because we’re nothing without validation from social media.
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.append('response_type', 'code'); // We want a code. Not just any code. THE code.
    authUrl.searchParams.append('client_id', TWITTER_CLIENT_ID); // Twitter needs to know who’s asking.
    authUrl.searchParams.append('redirect_uri', CALLBACK_URL); // Twitter needs to know where to send the results.
    authUrl.searchParams.append('scope', 'tweet.read users.read'); // What we want to read. Because writing is too much responsibility.
    authUrl.searchParams.append('state', state); // The state parameter. For those who love being organized.
    authUrl.searchParams.append('code_challenge', codeChallenge); // Because Twitter said we need it. So here it is.
    authUrl.searchParams.append('code_challenge_method', 'S256'); // Because S256 sounds like we know what we’re doing.

    console.log('Auth URL:', authUrl.toString()); // Let’s see where we’re sending people.
    res.redirect(authUrl.toString()); // And off they go!
});

// Twitter OAuth 2.0 callback handler. When Twitter decides if we’re worthy.
app.get('/twitter-callback', async (req, res) => {
    const { state, code } = req.query; // Pull the state and code from the query. Like a magician pulling a rabbit from a hat.
    const storedState = req.session.state; // We’ve been waiting for this moment.
    const codeVerifier = req.session.codeVerifier; // And this too. We didn’t forget.

    // Validate the state parameter. We’re not falling for any tricks here.
    if (state !== storedState) {
        return res.status(400).send('Invalid state parameter'); // Nope. Not today.
    }

    try {
        // Exchange the authorization code for an access token. Because we’ve come too far to quit now.
        const tokenResponse = await axios.post('https://api.twitter.com/2/oauth2/token', 
            new URLSearchParams({
                'code': code, // The precious code.
                'grant_type': 'authorization_code', // We’re authorized. Or about to be.
                'client_id': TWITTER_CLIENT_ID, // Don’t forget who we are.
                'redirect_uri': CALLBACK_URL, // Or where we’re going.
                'code_verifier': codeVerifier // This little guy. He makes it all possible.
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded', // Because Twitter’s picky like that.
                    'Authorization': `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}` // Basic auth. The name says it all.
                }
            }
        );

        req.session.accessToken = tokenResponse.data.access_token; // Got it. The golden ticket.
        
        // Fetch and store the authenticated user’s Twitter ID. Because what’s the point if we don’t know who you are?
        const userInfoResponse = await axios.get('https://api.twitter.com/2/users/me', {
            headers: {
                'Authorization': `Bearer ${req.session.accessToken}` // Don’t forget your bearer token. It’s your VIP pass.
            }
        });
        req.session.userId = userInfoResponse.data.data.id; // Now we know who you are. Let’s keep it that way.
        
        console.log('User authenticated. User ID:', req.session.userId); // Let’s make it official.
        res.redirect('/twitter.html'); // And send you to your shiny new dashboard.
    } catch (error) {
        console.error('Error in Twitter callback:', error.response ? error.response.data : error); // Twitter isn’t perfect either, apparently.
        res.status(500).send('Authentication failed'); // We’re done here. For now.
    }
});

// Endpoint to fetch user info. Because we like to share.
app.get('/user-info', async (req, res) => {
    if (!req.session.accessToken) {
        return res.status(401).json({ error: 'Not authenticated' }); // Nice try. You’re not getting in without an access token.
    }

    try {
        const userResponse = await axios.get('https://api.twitter.com/2/users/me', {
            headers: {
                'Authorization': `Bearer ${req.session.accessToken}` // Just in case Twitter forgot who you are.
            },
            params: {
                'user.fields': 'profile_image_url' // We care about your profile picture. It’s the little things.
            }
        });
        res.json(userResponse.data); // And here’s your info, wrapped up nicely.
    } catch (error) {
        console.error('Error fetching user info:', error.response ? error.response.data : error); // Oops. Something went wrong.
        res.status(500).json({ error: 'Failed to fetch user info' }); // Not today, friend.
    }
});

// Check authentication status. Because we like to know who’s who.
app.get('/check-auth', (req, res) => {
    res.json({ authenticated: !!req.session.accessToken }); // If you’ve got an access token, you’re in. If not, well, you’re out.
});

// Logout endpoint to destroy the session. Bye bye, see you next time.
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err); // Ouch. Even logging out can be hard sometimes.
        }
        res.redirect('/twitter.html'); // Back to the login page you go. Start fresh.
    });
});

// Function to fetch user tweets. Could be expanded for paid API access if you’re into that kind of thing.
async function getUserTweets(userId, accessToken, maxTweets = 100) {
    let tweets = [];
    let paginationToken = null;
    
    while (tweets.length < maxTweets) {
        try {
            const response = await axios.get(`https://api.twitter.com/2/users/${userId}/tweets`, {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`, // Yes, Twitter. It’s still us.
                    'Content-Type': 'application/json' // JSON, because XML is so last decade.
                },
                params: {
                    'max_results': Math.min(100, maxTweets - tweets.length), // Don’t get greedy now.
                    'tweet.fields': 'public_metrics', // Show me the numbers.
                    'expansions': 'author_id', // Expand! We want the big picture.
                    ...(paginationToken && { 'pagination_token': paginationToken }) // Because Twitter likes to keep things paginated.
                }
            });
            
            if (response.data.data) {
                tweets = tweets.concat(response.data.data); // Keep collecting those tweets. Gotta catch ‘em all.
                paginationToken = response.data.meta.next_token; // Paging, just like an old library catalog.
            }
            
            if (!paginationToken || tweets.length >= maxTweets) break; // We’re done here. No need to overstay our welcome.
        } catch (error) {
            console.error('Error fetching user tweets:', error.response ? error.response.data : error.message); // Even Twitter has bad days.
            throw error; // Let’s not sugarcoat it. This needs to be handled.
        }
    }
    
    return tweets; // Here are your tweets, all nice and collected.
}

// Function to fetch interactions (likes and retweets) on a tweet. Because everyone loves attention.
async function getInteractions(tweetId, accessToken) {
    try {
        const likesResponse = await axios.get(`https://api.twitter.com/2/tweets/${tweetId}/liking_users`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }, // Still us, Twitter. Don’t forget.
            params: { 'max_results': 100 } // We don’t need a thousand likes. Yet.
        });
        const retweetsResponse = await axios.get(`https://api.twitter.com/2/tweets/${tweetId}/retweeted_by`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }, // And again. Just in case.
            params: { 'max_results': 100 } // Same deal with retweets. Let’s keep it reasonable.
        });
        // Note: Fetching replies requires a different approach. Because Twitter loves to be difficult.
        return {
            likes: likesResponse.data.data || [], // Like it or leave it.
            retweets: retweetsResponse.data.data || [] // Retweet it or regret it.
        };
    } catch (error) {
        console.error('Error fetching interactions:', error); // Oops. Twitter broke something again.
        throw error; // You’ll have to deal with this one.
    }
}

// Function to check if a user is following or being followed by another user. Stalking made easy.
async function getFollowStatus(userId, interactorId, accessToken) {
    try {
        const followingResponse = await axios.get(`https://api.twitter.com/2/users/${userId}/following`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }, // Yes, it’s still us. Promise.
            params: { 'user.fields': 'id', 'max_results': 1000 } // 1000 followers? Let’s see if you’re really that popular.
        });
        const followersResponse = await axios.get(`https://api.twitter.com/2/users/${userId}/followers`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }, // Same story. Different endpoint.
            params: { 'user.fields': 'id', 'max_results': 1000 } // 1000 is the magic number. Twitter says so.
        });
        
        const isFollowing = followingResponse.data.data.some(user => user.id === interactorId); // Are we following each other? Or is it just a one-sided affair?
        const isFollower = followersResponse.data.data.some(user => user.id === interactorId); // Same question, different direction.
        
        return { isFollowing, isFollower }; // Here’s the tea on your relationship status.
    } catch (error) {
        console.error('Error fetching follow status:', error); // Sorry, even this can be too much for Twitter sometimes.
        throw error; // Pass it up the chain. We’re done here.
    }
}

// Endpoint to analyze interactions. For those who want to dive deep. And maybe pay for it too.
app.get('/analyze-interactions', async (req, res) => {
    console.log('Access Token in session:', !!req.session.accessToken); // Do you have what it takes to be here?
    console.log('User ID in session:', req.session.userId); // We know who you are. Or do we?

    if (!req.session.accessToken) {
        console.log('Attempt to analyze interactions without authentication'); // No token? No service.
        return res.status(401).json({ error: 'Not authenticated' }); // Get out of here and come back when you’re ready.
    }

    const cacheKey = `interactions_${req.session.userId}`; // Let’s see if we’ve already done this.
    const cachedData = myCache.get(cacheKey);
    
    if (cachedData) {
        console.log('Returning cached interaction data'); // No need to reinvent the wheel. Here’s what we found last time.
        return res.json(cachedData); // You’re welcome.
    }

    console.log('Starting interaction analysis for user:', req.session.userId); // Alright, let’s get to work.

    try {
        const userInfoResponse = await axios.get('https://api.twitter.com/2/users/me', {
            headers: { 'Authorization': `Bearer ${req.session.accessToken}` } // Because Twitter still needs to know it’s us.
        });
        const userId = userInfoResponse.data.data.id; // Confirmation: You’re who we thought you were.
        console.log('User ID from API:', userId); // Let’s make it official.

        console.log('Fetching tweets for user:', userId); // Let’s go tweet hunting.
        const tweets = await getUserTweets(userId, req.session.accessToken); // This is where the magic happens.
        console.log(`Fetched ${tweets.length} tweets`); // How much of a Twitter fiend are you, anyway?
        
        let interactors = {};
        for (const tweet of tweets) {
            const interactions = await getInteractions(tweet.id, req.session.accessToken); // Let’s see who’s been paying attention.
            
            for (const liker of interactions.likes) {
                interactors[liker.id] = interactors[liker.id] || { likes: 0, retweets: 0, username: liker.username }; // Keep score of those likes.
                interactors[liker.id].likes++;
            }
            
            for (const retweeter of interactions.retweets) {
                interactors[retweeter.id] = interactors[retweeter.id] || { likes: 0, retweets: 0, username: retweeter.username }; // And those retweets.
                interactors[retweeter.id].retweets++;
            }
        }

        // Sort interactors by total interactions and limit to top 10. Because not everyone can be at the top.
        const sortedInteractors = Object.entries(interactors)
            .sort(([,a], [,b]) => (b.likes + b.retweets) - (a.likes + a.retweets))
            .slice(0, 10);

        // Fetch follow status for top interactors. Time to see who’s really following who.
        for (const [interactorId, interactor] of sortedInteractors) {
            const followStatus = await getFollowStatus(userId, interactorId, req.session.accessToken); // Get the dirt on this relationship.
            interactor.isFollowing = followStatus.isFollowing;
            interactor.isFollower = followStatus.isFollower;
        }

        console.log(`Analysis complete. Found ${sortedInteractors.length} top interactors.`); // Job done. You’re welcome.
        const result = Object.fromEntries(sortedInteractors);
        myCache.set(cacheKey, result); // Stash it away for next time.
        res.json(result); // Here’s what we found. Don’t spend it all in one place.
    } catch (error) {
        console.error('Error analyzing interactions:', error.response ? error.response.data : error.message); // Something went wrong. Again.
        return res.status(500).json({ 
            error: 'Failed to analyze interactions', 
            details: error.response ? error.response.data : error.message,
            message: 'Please check your Twitter Developer App settings and ensure you have the required access level.' // Blame Twitter. It’s probably their fault.
        });
    }
});

// Start the server. Ready or not, here we come.
app.listen(port, () => {
    console.log(`Server running on port ${port}`); // This is happening. Right now.
    console.log(`TWITTER_CLIENT is ${process.env.TWITTER_CLIENT ? 'set' : 'not set'}`); // Is Twitter ready for us? Let’s hope so.
    console.log(`TWITTER_CLIENT_SECRET is ${process.env.TWITTER_CLIENT_SECRET ? 'set' : 'not set'}`); // If not, we’re doomed.
    console.log(`TWITTER_CALLBACK_URL is ${process.env.TWITTER_CALLBACK_URL}`); // The callback URL, the backbone of it all.
});
