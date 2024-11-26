pipeline {
    agent any

    parameters {
        string(name: 'STORIES_DIR', defaultValue: params.STORIES_DIR ?: '/srv/stories', description: 'Stories directory')
    }

    stages {
        stage('Build') {
            steps {
                sh 'docker compose build'
            }
        }
        stage('Deploy') {
            steps {
                sh 'docker compose down --remove-orphans'
                sh 'docker compose up -d'
            }
        }
    }
}
