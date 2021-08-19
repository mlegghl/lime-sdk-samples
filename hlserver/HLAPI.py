#!/usr/bin/env python3


import requests
import json
import jwt
import datetime
import urllib.parse
import os

URL=os.environ.get('HLSERVER_URL')

class HLAPI:

    class User:
        def __init__(self, idx, name, email, token):
            self.idx = idx
            self.name = name
            self.email = email
            self.token = token

    class Participant:
        def __init__(self, user_token, session_token):
            self.user_token = user_token
            self.session_token = session_token
            
    class SessionInfo:
        def __init__(self, sid, url, ws_url, s1, s2, user1, user2):
            self.sid = sid
            self.url = url
            self.ws_url = ws_url
            self.participant1 = HLAPI.Participant(user1.token, s1)
            self.participant2 = HLAPI.Participant(user2.token, s2)
            
    def __init__(self, apikey, partner_key, enterprise_id):
        self.apikey = apikey
        self.partner_key = partner_key
        self.enterprise_id = enterprise_id

    ## Public API ##

    """
    Look up a user by email in *our*
    enterprise and return some info about
    them
    """
    def auth_user(self, email):
        users = self.do_GET("/v1r1/enterprise/users", {'authorization': self.make_jwt()}, {'filter': 'email='+email})
        user1_details = self.do_GET(f"/v1r1/enterprise/users/{users['entries'][0]['id']}", {'authorization': self.make_jwt()})

        return HLAPI.User(user1_details['id'], user1_details['name'], email, user1_details['token'])

    """
    Anonymously authenticate a user
    enterprise and return a token
    """
    def anonymous_auth(self):
        resp = self.do_POST("/v1/anonymous/auth", {'authorization': self.make_jwt()})

        return resp['token']

    """
    Create a dirty session
    """
    def create_session(self, auth):
        session1 = self.do_POST("/v1/sessions", {'authorization': auth}, { 'force_new': True })
        session_info = self.do_GET('/v1r1/session/auth', {'authorization': session1['token']})

        return HLAPI.SessionInfo(session1['id'], session_info['gss_info']['server'],
                                 session_info['gss_info']['wsserver'],
                                 session_info['gss_info']['token'], '',
                                 HLAPI.User(0, '', '', session1['users'][0]['token']), HLAPI.User(0, '', '', ''))     

    """
    Create a dirty session
    """
    def get_session(self, auth, id):
        print(auth)
        print(id)
        session = self.do_GET(f'/v1/sessions/{id}', {'authorization': auth})
        return session                       

    """
    Create a session between two users.
    Return the Session Info
    """
    def make_session(self, user1, user2):
        # have user1 create a session with user2
        session1 = self.do_POST('/v1/sessions', {'authorization': user1.token}, {'contact_tokens': [user2.token]})
        # have user2 get access to this session
        session2 = self.do_GET(f'/v1/sessions/{session1["id"]}', {'authorization': user2.token})

        # have user1 request video, this gets the session server
        session_info = self.do_POST('/v1/session/video', {'authorization': session1['token']}, {'user_token': user1.token})

        return HLAPI.SessionInfo(session1['id'], session_info['gss_info']['server'],
                                 session_info['gss_info']['wsserver'],
                                 session_info['gss_info']['token'], session2['token'],
                                 user1, user2)
        
    ## Internal API ##
        
    def make_jwt(self):
        exp = datetime.datetime.utcnow() + datetime.timedelta(seconds = 60 * 60)
        payload = {
            'iss': 'Ghazal',
            'sub': f'Partner:{self.enterprise_id}',
            'aud': 'Ghazal',
            'exp': exp
        }
        
        token = jwt.encode(payload = payload, key = self.partner_key, algorithm = 'RS256')
        return token

    def do_GET(self, path, extra_headers, query_params = {}):
        headers = {'x-helplightning-api-key': self.apikey,
                   'content-type': 'application/json'}
        headers.update(extra_headers)

        r = requests.get(f'{URL}{path}', params = urllib.parse.urlencode(query_params), headers = headers)
        r.raise_for_status()
        return r.json()
    
    def do_POST(self, path, extra_headers, body = {}):
        headers = {'x-helplightning-api-key': self.apikey,
                   'content-type': 'application/json'}
        headers.update(extra_headers)
        
        body = json.dumps(body)
        
        r = requests.post(f'{URL}{path}', data = body, headers = headers)
        r.raise_for_status()
        return r.json()
