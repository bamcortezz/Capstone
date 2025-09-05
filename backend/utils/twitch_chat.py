import irc.bot
import socket
import re
from .sentiment_analyzer import sentiment_analyzer

class TwitchChatBot(irc.bot.SingleServerIRCBot):
    def __init__(self, token, username, channel, socket_handler):
        if not token.startswith('oauth:'):
            token = 'oauth:' + token
            
        self.token = token
        self.channel = '#' + channel.lower()
        self.socket_handler = socket_handler
        self._should_disconnect = False
        
        # Create IRC bot connection
        server = 'irc.chat.twitch.tv'
        port = 6667

        nickname = username.lower()
        super().__init__([(server, port, token)], nickname, nickname)
        
    def on_welcome(self, connection, event):
        connection.cap('REQ', ':twitch.tv/membership')
        connection.cap('REQ', ':twitch.tv/tags')
        connection.cap('REQ', ':twitch.tv/commands')
        
        # Join the channel
        connection.join(self.channel)
        print(f"Successfully joined channel {self.channel}")
        
    def on_error(self, connection, event):
        print(f"Error: {event.arguments[0] if event.arguments else 'Unknown error'}")
        self._should_disconnect = True
        
    def on_disconnect(self, connection, event):
        print("Disconnected from server")
        if not self._should_disconnect:
            connection.reconnect()

    def disconnect(self):
        try:
            if self.connection.is_connected():
                self.connection.part(self.channel)
                self.connection.disconnect("Goodbye!")
        except Exception as e:
            print(f"Error during disconnect: {e}")
        finally:
            self._should_disconnect = True

    def on_pubmsg(self, connection, event):

        message = event.arguments[0]
        username = event.source.split('!')[0]

        sentiment_result = sentiment_analyzer.analyze_text(message)
        
        message_data = {
            'username': username,
            'message': message,
            'sentiment': sentiment_result['sentiment'],
            'confidence': sentiment_result['confidence']
        }
        
        self.socket_handler(message_data)

def extract_channel_name(url):
    pattern = r'(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]+)'
    match = re.match(pattern, url)
    if match:
        return match.group(1)
    return None
