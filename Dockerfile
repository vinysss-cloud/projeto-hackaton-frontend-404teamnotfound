###################
# BUILD
###################
# Use a imagem oficial do Node.js como base
FROM node:18.16.0 AS build
# Defina o diretório de trabalho no contêiner
WORKDIR /app
# Copie o projeto da aplicação para o diretório de trabalho
COPY . .
# Define the build argument and environment variable
ARG ANGULAR_BUILD_ENV=production
# Instala as dependências do projeto
RUN npm install
# Execute a build do projeto Angular
RUN npx ng build --configuration=$ANGULAR_BUILD_ENV --output-hashing=all --output-path=dist/app

###################
# RUNTIME
###################
# Use uma imagem do Nginx para servir a aplicação Angular
FROM nginx:alpine
# Copie os arquivos compilados da aplicação Angular para o diretório padrão do Nginx
COPY --from=build /app/dist/app /usr/share/nginx/html
# Altera porta do nginx para 8080
RUN sed -i 's/80;/8080;/g' /etc/nginx/conf.d/default.conf
# Exponha a porta 80 para acessar a aplicação
EXPOSE 8080
# Comando para iniciar o Nginx
CMD ["nginx", "-g", "daemon off;"]
