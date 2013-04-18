define([
    'underscore'
], function(
    _
) {
'use strict';
return ['$scope', '$resource', 'wdmConversationsCache', 'wdmMessagesCache', '$q', '$http',
        'wdpMessagePusher', '$timeout', 'wdAlert', 'GA', '$route', 'wdmConversations',
function($scope,   $resource,   wdmConversationsCache,   wdmMessagesCache,   $q,   $http,
         wdpMessagePusher,   $timeout,   wdAlert,   GA,   $route,   wdmConversations) {

$scope.serverMatchRequirement = $route.current.locals.versionSupport;
$scope.conversations = wdmConversations;
$scope.activeConversation = null;
$scope.cvsChanging = false;
$scope.cvsLoaded = true;
$scope.cvsListFirstLoading = true;


wdpMessagePusher.channel('messages_add.wdm', function(e, msg) {
    var cid = msg.data.threadId;
    var mid = msg.data.messageId;
    var c = $scope.conversations.getById(cid);
    if (c) {
        c.messages.fetch(mid).then(function() {
            if (c === $scope.activeConversation) {
                scrollIntoView();
            }
        });
    }
    else {
        $scope.conversations.fetch(cid);
    }
});

$scope.selectTip = function(c) {
    return c.selected ? $scope.$root.DICT.messages.ACTION_DESELECT : $scope.$root.DICT.messages.ACTION_SELECT;
};

$scope.editorPlaceholder = function(c) {
    if (!c) { return; }
    var hasRecieved = c.messages.collection.some(function(m) {
        return m.type !== 2;
    });
    return (hasRecieved ? $scope.$root.DICT.messages.EDITOR_REPLY_PLACEHOLDER + c.displayNames.join(', ') : $scope.$root.DICT.messages.EDITOR_SEND_PLACEHOLDER) + '...';
};

$scope.createConversation = function() {
    var c = _($scope.conversations.collection).find(function(c) {
        return c.isNew;
    });
    if (!c) {
        c = $scope.conversations.create();
    }
    activeConversation(c);
};

$scope.showConversation = function(conversation) {
    if (!conversation) { return; }
    var promise = activeConversation(conversation);
    promise.then(scrollIntoView);
    return promise;
};

$scope.sendMessage = function(c) {
    if (!c.draft) { return; }
    // Broadcast beforeMessageSend to assure all necessary data that should be prepared and merge into scope
    $scope.$broadcast('wdm:beforeMessageSend', c);
    $scope.conversations.sendMessages(c).then(function(cc) {
        if (cc !== $scope.activeConversation) {
            $scope.showConversation(cc);
        }
    }, function() {
        GA('messages:send_failed');
    });
    scrollIntoView();
};

$scope.removeSelected = function() {
    wdAlert.confirm(
        $scope.$root.DICT.messages.CONFIRM_DELETE_TITLE,
        $scope.$root.DICT.messages.CONFIRM_DELETE_CONTENT,
        $scope.$root.DICT.messages.CONFIRM_DELETE_OK,
        $scope.$root.DICT.messages.CONFIRM_DELETE_CANCEL
    ).then(function() {
        $scope.conversations.removeSelected();
        if (!$scope.conversations.contains($scope.activeConversation)) {
            $scope.showConversation($scope.conversations.collection[0]);
        }
    });
};

$scope.removeMessage = function(c, m) {
    wdAlert.confirm(
        $scope.$root.DICT.messages.CONFIRM_DELETE_TITLE,
        $scope.$root.DICT.messages.CONFIRM_DELETE_CONTENT,
        $scope.$root.DICT.messages.CONFIRM_DELETE_OK,
        $scope.$root.DICT.messages.CONFIRM_DELETE_CANCEL
    ).then(function() {
        $scope.conversations.removeMessages(c, m);
        if (!$scope.conversations.contains($scope.activeConversation)) {
            $scope.showConversation($scope.conversations.collection[0]);
        }
    });
};

// $scope.resendMessage = function(message) {
//     var promise;
//     if (typeof message.id === 'string') {
//         // client only message data.
//         promise = sendMessage(message);
//     }
//     else {
//         promise = resendMessage(message);
//     }
//     promise.then(function() {
//         pullConversation(message.thread_id);
//     });
// };

// Startup
var timer;
if ($scope.serverMatchRequirement) {
    $scope.conversations.fetch().then(function() {
        $scope.showConversation($scope.conversations.collection[0]);
        $scope.cvsListFirstLoading = false;
    });

    wdpMessagePusher.start();

    timer = $timeout(function update() {
       timer = $timeout(update, 60000 - Date.now() % 60000);
    }, 60000 - Date.now() % 60000);
}

// Shutdown
$scope.$on('$destroy', function() {
    $scope.conversations.clear();
    $scope.cvsCache.reset();
    $timeout.cancel(timer);
    wdpMessagePusher.unchannel('.wdm');
});

function scrollIntoView() {
    _.defer(function() {
        $scope.$broadcast('wdm:autoscroll:bottom');
    });
}
function activeConversation(c) {
    var defer = $q.defer();
    if ($scope.activeConversation === c) {
        defer.reject();
    }
    else {
        var curActiveCvs = $scope.activeConversation;
        if ($scope.conversations.contains(curActiveCvs)) {
            curActiveCvs.allRead();
        }
        // Change c content right now.
        $scope.activeConversation = c;
        // If already read any message, just active it.
        // Or load messages.
        if (c.messages.length || c.loaded) {
            defer.resolve(c);
        }
        else {
            $scope.cvsChanging = true;
            c.messages.fetch().then(function success() {
                $scope.cvsChanging = false;
                defer.resolve(c);
            }, function error() {
                $scope.cvsChanging = false;
                defer.reject();
            });
        }
    }
    return defer.promise;
}

}];
});
