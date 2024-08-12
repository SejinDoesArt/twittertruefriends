<!--
    So, you’ve found your way to the Twitter Interaction Analysis project. Lucky you.

    Copyright (C) 2024, @sejindoesart – because someone has to take the credit.

    This HTML is as free as it gets: feel free to redistribute it, remix it, or otherwise
    mess around with it under the terms of the GNU General Public License, courtesy of
    the fine folks at the Free Software Foundation – version 3 of the License, or any
    later version if you’re feeling particularly daring.

    That said, this file comes with absolutely NO WARRANTY; not even the faintest whisper
    of one. No guarantees of usefulness, merchantability, or fitness for any purpose
    whatsoever. If it breaks, you get to keep both pieces.

    If you’re one of those rare souls who reads licenses, you should have received a copy
    of the GNU General Public License with this project. If not, take a trip to
    <https://www.gnu.org/licenses/> and get yourself enlightened.
-->


<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Twitter Interaction Analysis</title>
    <style>
        /* Making it look decent because why not */
        body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        button { padding: 10px 20px; font-size: 16px; cursor: pointer; margin: 10px 0; }
        #userInfo, #analysisResults { margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Twitter Interaction Analysis</h1>
        <!-- Where we let you know if you’re in or not -->
        <div id="loginStatus"></div>
        <!-- Showing off your Twitter info, because why not? -->
        <div id="userInfo"></div>
        <!-- The magic button to start the Twitter dance -->
        <button id="loginButton">Login with Twitter</button>
        <!-- Analyzing your popularity, but only if you're worthy -->
        <button id="analyzeButton" style="display:none;">Analyze Interactions</button>
        <!-- Letting you leave the party gracefully -->
        <button id="logoutButton" style="display:none;">Logout</button>
        <!-- Where we drop the results, assuming you pass the test -->
        <div id="analysisResults"></div>
    </div>

    <script>
        const loginButton = document.getElementById('loginButton');
        const analyzeButton = document.getElementById('analyzeButton');
        const logoutButton = document.getElementById('logoutButton');
        const loginStatus = document.getElementById('loginStatus');
        const userInfo = document.getElementById('userInfo');
        const analysisResults = document.getElementById('analysisResults');

        // Check if you’re cool enough to be logged in as soon as the page loads
        function checkAuthStatus() {
            fetch('/check-auth')
                .then(response => response.json())
                .then(data => {
                    if (data.authenticated) {
                        // Welcome to the inner circle, here’s what you get
                        loginStatus.textContent = 'Logged in';
                        loginButton.style.display = 'none';
                        analyzeButton.style.display = 'inline-block';
                        logoutButton.style.display = 'inline-block';
                        fetchUserInfo(); // Show off your Twitter bling
                    } else {
                        // Not logged in? How sad. Time to change that.
                        loginStatus.textContent = 'Not logged in';
                        loginButton.style.display = 'inline-block';
                        analyzeButton.style.display = 'none';
                        logoutButton.style.display = 'none';
                        userInfo.innerHTML = '';
                        analysisResults.innerHTML = '';
                    }
                })
                .catch(error => {
                    console.error('Error checking auth status:', error);
                    loginStatus.textContent = 'Error checking login status';
                });
        }

        // Fetch your Twitter deets because you’re just that important
        function fetchUserInfo() {
            fetch('/user-info')
                .then(response => response.json())
                .then(data => {
                    if (data.data) {
                        // Flaunt your Twitter identity
                        userInfo.innerHTML = `
                            <img src="${data.data.profile_image_url}" alt="Profile Image" style="border-radius: 50%;">
                            <p>Username: ${data.data.username}</p>
                            <p>Name: ${data.data.name}</p>
                        `;
                    } else {
                        userInfo.textContent = 'User info not available'; // Maybe Twitter didn’t feel like sharing today
                    }
                })
                .catch(error => {
                    console.error('Error fetching user info:', error);
                    userInfo.textContent = 'Error fetching user info'; // Well, that didn’t go as planned
                });
        }

        // Analyzing your Twitter interactions because we’re all secretly stalkers
        function analyzeInteractions() {
            analysisResults.innerHTML = 'Analyzing interactions... Patience is a virtue.';
            fetch('/analyze-interactions')
                .then(response => response.json())
                .then(data => {
                    // Let’s build a table to display who’s paying attention to you
                    let tableHTML = `
                        <h2>Top Interactors</h2>
                        <table>
                            <tr>
                                <th>Username</th>
                                <th>Likes</th>
                                <th>Retweets</th>
                                <th>Following</th>
                                <th>Follower</th>
                            </tr>
                    `;
                    for (const [id, user] of Object.entries(data)) {
                        tableHTML += `
                            <tr>
                                <td>${user.username}</td>
                                <td>${user.likes}</td>
                                <td>${user.retweets}</td>
                                <td>${user.isFollowing ? 'Yes' : 'No'}</td>
                                <td>${user.isFollower ? 'Yes' : 'No'}</td>
                            </tr>
                        `;
                    }
                    tableHTML += '</table>';
                    analysisResults.innerHTML = tableHTML;
                })
                .catch(error => {
                    console.error('Error analyzing interactions:', error);
                    analysisResults.textContent = 'Error analyzing interactions'; // Apparently, the Internet had a bad day
                });
        }

        // When you click the login button, we send you off to Twitter
        loginButton.addEventListener('click', () => {
            window.location.href = '/auth/twitter';
        });

        // Analyze button: When you’re ready to see who’s been liking and retweeting your stuff
        analyzeButton.addEventListener('click', analyzeInteractions);

        // Logout button: A graceful exit when you’ve had enough of this nonsense
        logoutButton.addEventListener('click', () => {
            fetch('/logout')
                .then(() => {
                    checkAuthStatus(); // Let’s see where we stand after the big goodbye
                })
                .catch(error => console.error('Error logging out:', error));
        });

        // Let’s see if you’re already logged in, as soon as you arrive
        checkAuthStatus();
    </script>
</body>
</html>
