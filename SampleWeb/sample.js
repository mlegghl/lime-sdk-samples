// Location of the sample HLServer
const HOST_URL = 'http://localhost:8777'

function refresh(state) {
    console.log('refresh', state);

    // show error message on failure
    document.querySelector('#errorMsg').visible = state.error && !!state.error.length

    let login = document.querySelector('#login');
    let authenticated = document.querySelector('#authenticated');
    let incall = document.querySelector('#incall');
    let flowContainer = document.querySelector('#flow-container');

    if (state.state == STATE_LOGIN) {
        show(login);
        hide(authenticated);
        hide(incall);
    } else if (state.state == STATE_AUTHENTICATED) {
        hide(login);
        show(authenticated);
        hide(incall);
    } else if (state.state == STATE_IN_CALL) {
        hide(flowContainer);

        // update the pin code
        let sessionPincode = document.querySelector('#session-pincode');
        sessionPincode.innerHTML = state.session.pin;

        // start the HL SDK
        let hlDiv = document.querySelector('#hl-call');
        state.callClient = HL.CallClientFactory.CallClient;

        let name = randomName();
        const call = new HL.Call(state.session.session_id,
                                 state.session.session_token,
                                 state.session.user_token,
                                 state.session.url,
                                 '', name, '');
        // set up some delegates to handle messages
        const delegate = {
            onCallEnded: (reason) =>{
                console.log('onCallEnded', reason);
                // set the state back to authenticated
                state.state = STATE_AUTHENTICATED;
                state.session = null;
                state.callClient = null;

                refresh(state);
            },
            onScreenCaptureCreated: (image) => {
                // TODO: prompt to save this somewhere?
                // or ignore it, it'll be uploaded to the server
                //  automatically
            }
        };

        state.callClient.delegate = delegate;
        state.callClient.startCall(call, hlDiv).then((callID) => {
            console.log('Call started...', callID);
        }).catch(err => {
            if (err instanceof HL.CallException) {
                console.error('Error creating Help Lightning call', err.message);
            } else {
                console.error('Unknown error', err);
            }

            resetState(state);
            refresh(state);
        });
        
        show(incall);
    } else {
        console.warn('Unknown state', state);
        resetState(state);
        refresh(state);
    }
}

function show(div) {
    div.style.display = 'block';
}

function hide(div) {
    div.style.display = 'none';
}

function resetState(state) {
    state.state = STATE_LOGIN;
    state.error = null;
    state.token = null;
    state.session = null;
    state.callClient = null;
}

function randomName() {
    let n = Math.floor(Math.random() * 100000);
    return `User_${n}`;
}

function toggleModal() {
    let modal = document.querySelector('#pin-modal');
    modal.classList.contains('is-active') ? modal.classList.remove('is-active') : modal.classList.add('is-active'); 
}

function onLogin(target, state) {
    let email = document.querySelector('#email').value;
    let params = new URLSearchParams({'email': email});
    
    return fetch(`${HOST_URL}/auth?${params.toString()}`)
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Invalid email address');
            }
        })
        .then(response => {
            let name = document.querySelector('#username');
            name.textContent = response.name;
            let newState = {
                ...state,
                state: STATE_AUTHENTICATED, // move to authenticated state
                token: response.token
            };
            
            return newState;
        });
}

function createSession(target, state) {

    return fetch(`${HOST_URL}/session`, {
        method: 'POST',
        headers: {
            'Content-type': 'application/json',
            'Authorization': state.token
        },
        body: JSON.stringify({'contact_email': ''})
    }).then(response => {
        if (response.ok) {
            return response.json()
        } else {
            throw new Error('Unable to create session');
        }
    }).then(response => {
        let newState = {
            ...state,
            state: STATE_IN_CALL,
            session: {
                pin: response.sid,
                session_id: response.session_id,
                user_token: response.user_token,
                session_token: response.session_token,
                url: response.ws_url
            }
        };
        
        return newState;
    });
}

function joinSession(target, state) {
    let pin = document.querySelector('#pincode').value;
    let params = new URLSearchParams({'sid': pin});
    
    return fetch(`${HOST_URL}/session?${params.toString()}`, {
        method: 'GET',
        headers: { 'Authorization': state.token || '' }
    }).then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error('Invalid PIN');
        }
    }).then(response => {
        let newState = {
            ...state,
            state: STATE_IN_CALL,
            session: {
                pin: response.sid,
                session_id: response.session_id,
                user_token: response.user_token,
                session_token: response.session_token,
                url: response.ws_url
            }
        };
        
        return newState;
    });
}
