# syntax=docker/dockerfile:1

ARG RUBY_VERSION=3.4.8
FROM docker.io/library/ruby:$RUBY_VERSION-slim AS base

# # Set working directory
# WORKDIR /app

# Rails app lives here
WORKDIR /rails

# Install base packages
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libjemalloc2 && \
    ln -s /usr/lib/$(uname -m)-linux-gnu/libjemalloc.so.2 /usr/local/lib/libjemalloc.so && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Set Rails env
ENV RAILS_ENV="development" \
    BUNDLE_PATH="/bundle"

# Install packages needed to build gems
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential git libyaml-dev pkg-config && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Install bundler
RUN gem install bundler

# Copy only Gemfiles first for better caching
COPY Gemfile Gemfile.lock ./

# Install gems
RUN bundle install

# Copy the rest of the app
COPY . .

# Expose Rails port
EXPOSE 3000

RUN ./bin/rails db:setup

# Run Rails like `bin/rails server`
CMD ["bin/rails", "server", "-b", "0.0.0.0"]
