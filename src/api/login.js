import request from '@/request'

export function login(account, password) {
  const data = {
    account,
    password
  }
  return request({
    url: '/sso/login',
    method: 'post',
    data
  })
}

export function logout() {
  return request({
    url: '/sso/logout',
    method: 'get'
  })
}

export function getUserInfo() {
  return request({
    url: '/users/currentUser',
    method: 'get'
  })
}

export function register(account, mobilePhoneNumber, password) {
  const data = {
    account,
    mobilePhoneNumber,
    password
  }
  return request({
    url: '/sso/register',
    method: 'post',
    data
  })
}
