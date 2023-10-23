const localStoragePrefix = 'bitbucketPrParticipants-v1';

const workspaceId = 'workspace';
const repositoryId = 'repository';
const usernameId = 'username';
const passwordId = 'password';
const participantsId = 'participants';
const startCountButtonId = 'start-count';

const rolesName = 'roles';
const statesName = 'states';

const createLocalStorageVariable = variableId => `${localStoragePrefix}-${variableId}`
const storeFieldValue = variableId => localStorage.setItem(createLocalStorageVariable(variableId), document.getElementById(variableId).value);
const getFieldValue = variableId => localStorage.getItem(createLocalStorageVariable(variableId));

const storeWorkspace = () => storeFieldValue(workspaceId);
const storeRepository = () => storeFieldValue(repositoryId);
const storeUsername = () => storeFieldValue(usernameId);
const storePassword = () => storeFieldValue(passwordId);
const storeParticipants = () => storeFieldValue(participantsId);

const checkboxGroupToList = (variableName) => {
    let list = [];
    document.getElementsByName(variableName).forEach(element => {
        if (element.checked) {
            list.push(element.value);
        }
    });

    return list;
}

const loadDefaults = () => {
    const workspaceField = document.getElementById(workspaceId);
    const storedWorkspace = getFieldValue(workspaceId);
    workspaceField.onblur = storeWorkspace;
    if (storedWorkspace) {
        workspaceField.value = storedWorkspace;
    }

    const repositoryField = document.getElementById(repositoryId);
    const storedRepository = getFieldValue(repositoryId);
    repositoryField.onblur = storeRepository;
    if (storedRepository) {
        repositoryField.value = storedRepository;
    }

    const usernameField = document.getElementById(usernameId);
    const storedUsername = getFieldValue(usernameId);
    usernameField.onblur = storeUsername;
    if (storedUsername) {
        usernameField.value = storedUsername;
    }

    const passwordField = document.getElementById(passwordId);
    const storedPassword = getFieldValue(passwordId);
    passwordField.onblur = storePassword;
    if (storedPassword) {
        passwordField.value = storedPassword;
    }

    const participantsField = document.getElementById(participantsId);
    const storedParticipants = getFieldValue(participantsId);
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
    const countedRoleList = checkboxGroupToList(rolesName);
    const countedStateList = checkboxGroupToList(statesName);

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
                let countStateApproved = countedStateList.includes('APPROVED') === true || participant.approved === false;
                let countStateNeedsWork = countedStateList.includes('NEEDS_WORK') === true || participant.state !== 'changes_requested';
                if (countParticipant && countRole && countStateApproved && countStateNeedsWork) {
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
            let prCounterEntries = Object.entries(prCounter);
            let prCounterSorted = Object.fromEntries(prCounterEntries.sort((a, b) => a[1] - b[1]));
            let prCounterStringList = [];
            for(let name in prCounterSorted) {
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
