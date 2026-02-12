exports.getLogin = (req, res) => {
    res.render('auth/login', {
        title: "Přihlásit se",
        message: "Přihlásit se"
    })
};

exports.getRegister = (req, res) => {
    res.render('auth/register', {
        title: "Zaregistrovat se",
        message: "Zaregistrovat se"
    })
};

exports.postLogin = (req, res) => {
    // TODO: post loginu
};

exports.postRegister = (req, res) => {
    // TODO: post registrace
};