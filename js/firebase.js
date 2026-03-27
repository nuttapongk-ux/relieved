// ============================================================
// firebase.js — Firebase Cloud Firestore Integration
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyAfal6grNtLApn1oiX8p0mbyb4TpsMYrDo",
    authDomain: "gloy-8831a.firebaseapp.com",
    databaseURL: "https://gloy-8831a-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "gloy-8831a",
    storageBucket: "gloy-8831a.firebasestorage.app",
    messagingSenderId: "920776916154",
    appId: "1:920776916154:web:eef1247abf4e1d77c89683",
    measurementId: "G-34F6XB9S9T"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// ============================================================
// 1. REQUESTS MANAGEMENT (Collection: 'requests')
// ============================================================

// ── Load all requests once ──
function fbLoadRequests() {
    return db.collection('requests').get().then(snapshot => {
        if (snapshot.empty) return [];
        const requests = [];
        snapshot.forEach(doc => {
            requests.push(doc.data());
        });
        return requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }).catch(err => {
        console.error('Firestore load error:', err);
        return [];
    });
}

// ── Save a single request (uses req.id as document ID) ──
function fbSaveRequest(req) {
    return db.collection('requests').doc(req.id).set(req).catch(err => {
        console.error('Firestore save error:', err);
        throw err;
    });
}

// ── Update specific fields of a request ──
function fbUpdateRequest(id, fields) {
    return db.collection('requests').doc(id).update(fields).catch(err => {
        console.error('Firestore update error:', err);
        throw err;
    });
}

// ── Listen to real-time changes for requests ──
function fbListenRequests(callback) {
    const unsubscribe = db.collection('requests').onSnapshot(snapshot => {
        if (snapshot.empty) {
            callback([]);
            return;
        }
        const requests = [];
        snapshot.forEach(doc => {
            requests.push(doc.data());
        });
        requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        callback(requests);
    }, err => {
        console.error('Firestore listen error:', err);
    });

    return unsubscribe;
}


// ============================================================
// 2. ADMIN CONFIG SETTINGS (Collection: 'settings')
// ============================================================
// We store arrays inside specific documents, e.g doc('requestTypes')

function fbLoadSettings(docId) {
    return db.collection('settings').doc(docId).get().then(doc => {
        if (!doc.exists) return null; // let caller handle fallback
        return doc.data().data; // assume we store { data: [...] }
    }).catch(err => {
        console.error(`Firestore load settings (${docId}) error:`, err);
        return null;
    });
}

function fbSaveSettings(docId, dataArray) {
    return db.collection('settings').doc(docId).set({ data: dataArray }).catch(err => {
        console.error(`Firestore save settings (${docId}) error:`, err);
        throw err;
    });
}

function fbListenSettings(docId, callback) {
    const unsubscribe = db.collection('settings').doc(docId).onSnapshot(doc => {
        if (!doc.exists) {
            callback(null);
            return;
        }
        callback(doc.data().data);
    }, err => {
        console.error(`Firestore listen settings (${docId}) error:`, err);
    });
    return unsubscribe;
}
