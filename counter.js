const workspaceId = 'workspace';
const repositoryId = 'repository';
const usernameId = 'username';
const passwordId = 'password';
const participantsId = 'participants';
const startCountButtonId = 'start_count';

const storeWorkspace = () => localStorage.setItem(workspaceId, document.getElementById(workspaceId).value);
const storeRepository = () => localStorage.setItem(repositoryId, document.getElementById(repositoryId).value);
const storeUsername = () => localStorage.setItem(usernameId, document.getElementById(usernameId).value);
const storePassword = () => localStorage.setItem(passwordId, document.getElementById(passwordId).value);
const storeParticipants = () => localStorage.setItem(participantsId, document.getElementById(participantsId).value);

const loadDefaults = () => {
    const workspaceField = document.getElementById(workspaceId);
    const storedWorkspace = localStorage.getItem(workspaceId);
    workspaceField.onblur = storeWorkspace;
    if (storedWorkspace) {
        workspaceField.value = storedWorkspace;
    }

    const repositoryField = document.getElementById(repositoryId);
    const storedRepository = localStorage.getItem(repositoryId);
    repositoryField.onblur = storeRepository;
    if (storedRepository) {
        repositoryField.value = storedRepository;
    }

    const usernameField = document.getElementById(usernameId);
    const storedUsername = localStorage.getItem(usernameId);
    usernameField.onblur = storeUsername;
    if (storedUsername) {
        usernameField.value = storedUsername;
    }

    const passwordField = document.getElementById(passwordId);
    const storedPassword = localStorage.getItem(passwordId);
    passwordField.onblur = storePassword;
    if (storedPassword) {
        passwordField.value = storedPassword;
    }

    const participantsField = document.getElementById(participantsId);
    const storedParticipants = localStorage.getItem(participantsId);
    participantsField.onblur = storeParticipants;
    if (storedParticipants) {
        participantsField.value = storedParticipants;
    }

    const startCountButton = document.getElementById(startCountButtonId);
    startCountButton.onclick = startCount;
}

const startCount = () => {
    const workspace = document.getElementById(workspaceId).value;
    const repository = document.getElementById(repositoryId).value;
    const username = document.getElementById(usernameId).value;
    const password = document.getElementById(passwordId).value;
    const participants = document.getElementById(participantsId).value;
    if (!workspace || !repository|| !username || !password || !participants) {
        alert('Missing required data');
        return;
    }

    const countedParticipantList = participants.split(/\r?\n/);
    const countedRoleList = [];
    document.getElementsByName('roles').forEach(role => {
        if (role.checked) {
            countedRoleList.push(role.value);
        }
    });
    const countApproved =  document.getElementsByName('exclude_state')[0].checked === false;

    const maxCallCount = 20;
    const basicAuth = btoa(`${username}:${password}`);
    const fetchArguments = {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${basicAuth}`,
        }
    }

    let prCounter = {};
    countedParticipantList.forEach(countedParticipant => prCounter[countedParticipant] = 0);

    const createPrPromise = pr => fetch(pr.links.self.href, fetchArguments)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch data from ${pr.links.self.href} with status ${response.status} - ${response.statusText}`);
            }

            return response.json();
        })
        .then(data => data.participants.forEach(participant => {
                let name = participant.user.display_name;
                let countParticipant = countedParticipantList.includes(name);
                let countRole = countedRoleList.includes(participant.role);
                let countState = participant.approved === false || countApproved === true;
                if (countParticipant && countRole && countState) {
                    prCounter[name]++;
                }
            })
        )
        .catch(error => {
            throw new Error(error);
        });


    let callCount = 0;
    let prPromiseList = [];
    let nextUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repository}/pullrequests?state=OPEN&page=1`;
    while (nextUrl != null && callCount < maxCallCount - 1) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', nextUrl, false);
        xhr.setRequestHeader('Authorization', `Basic ${basicAuth}`);
        xhr.onreadystatechange = () => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    let data = JSON.parse(xhr.responseText);
                    prPromiseList = prPromiseList.concat(data.values.map(createPrPromise));
                    nextUrl = data.next;
                } else {
                    throw new Error(`Failed to fetch data from ${nextUrl} with status ${xhr.status} - ${xhr.statusText}`);
                }
            }
        };

        xhr.send();
        callCount++;
    }

    Promise.allSettled(prPromiseList)
        .then(() => {
            let prCounterStringList = [];
            for(let name in prCounter) {
                let count = prCounter[name];
                prCounterStringList.push(`${name}: ${count}`);
            }

            alert(prCounterStringList.join('\n'));
        })
        .catch(error => {
            throw new Error(error)
        });
}

window.onload = loadDefaults;
