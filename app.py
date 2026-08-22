from flask import Flask, render_template, request, redirect, url_for

app = Flask(__name__)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/report')
def report():
    problem_type = request.args.get('type', 'other')
    return render_template('report.html', problem_type=problem_type)


if __name__ == '__main__':
    app.run(debug=True)
