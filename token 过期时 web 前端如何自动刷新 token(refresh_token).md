> 本文由 [简悦 SimpRead](http://ksria.com/simpread/) 转码， 原文地址 https://blog.csdn.net/acrodelphi/article/details/90671808

以 token 处理登录的 web 系统，一般会有两个 token：access-token 和 refresh-token。

node.js 中，一般用 jsonwebtoken 这个模块。

access-token，是用户输入登录的账号密码，后台去 db 验证然后颁发的，它一般记录在浏览器的 cookie 中，并在浏览器关闭时自动删除，页面访问或 ajax 访问会自动通过 cookie 传回到后台，后台直接内存中校验，不用访问 db，所以效率高；为了在 access-token 泄漏后及时止损，一般 access-token 会设置一个有效期，如 1-8 小时。

access-token 设置了有效期后，过期了怎么办？为了及时止损，有效期不能设置太长，过期是一定会遇到的，比如工作狂，如果有效期设置的是 8 小时，他开着浏览器工作 12 小时，费力断断续续花了 1 个小时（电话多，喝咖啡尿多）打了张订单，提交时 token 过期了。再比如某些大屏幕展示的页面，可能连续几天几月的开着。遇到过期怎么办？

1.  重定向到登录页面，用户输入账号密码登录后，再自动跳回订单页面，之前的资料都丢了，用户骂一句 “靠” 忍气吞声重新打。如果每天遇到一次，可能还可以忍。如果有效期太短，如 1 小时，每天遇到 5,6 次，那用户可能不干了，这时你可能要把未提交的订单资料暂时存到 localstorage 里面。
2.  弹出登录框。登录框内容和代码如何做，预先就加载了，每个页面都有这部分，感觉很浪费，因为大部分时间用不上，动态从后台加载，可能不好实现。
3.  登录后把账号密码记录在浏览器中，自动登录。但基于安全考虑，一般是用户特别勾选 “记住我”，才会加密记录账号密码到 localstorage 中，用户下次打开浏览器时自动登录。如果 token 过期就自动登录，如何及时止损？后台修改密码或禁用账号，如何同步到前端的 localstorage 中。大部分 app 是这么干的。以上 3 种都是要再次去后台数据库验证，所以 token 过期时间不能太短，否则效率很差。
4.  设置 refresh-token 机制，颁发 access-token 时同时颁发一个 refresh-token，唯一区别是 refresh-token 有效期比较长，比如 1 个月。当 access-token 过期后，拿着 refresh-token 到后台换取新的 access-token。通过在后台为 refresh-token 设置黑名单来及时止损，所以有黑名单的时候，可能效率也会一样的差。refresh-token 也过期后，那就只有老老实实的让用户输入账号密码登录了，就是前面的 1,2 方法。因为 refresh-token 不常用，所以最好不要放在 cookie 中避免每次自动传到后台，放在 localstorage 较好。

刷新 access-token 过程，如何让用户没感觉？思路是：发现 access-token，自动用 refresh-token 去刷新，然后再自动跳到原来页面或者自动调用一次原来的 ajax。

1.  web 页面访问时，nodejs 后台中间件拦截到 access-token 过期，返回一个 html，里面包含刷新 token 和跳转：
    
    ```
    <!DOCTYPE html>
    <html>
    <head>
    <script type="text/javascript" src='/js/jquery-1.11.1/jquery-1.11.1.min.js'></script>
    </head>
    <body>
    <script>
    var raw_url="<%-locals.raw_url%>";
    var login_url="<%-locals.login_url%>";
    var refresh_token=localStorage.getItem("<%-locals.cookie.IDs.refreshToken%>");
    $.ajax({
        cache:false,
        method:"get",
        async:true,
        url:'/app/account/refreshToken',
        data:{       
            refresh_token:refresh_token
        },
        success:function(data, textStatus){
            location.href = raw_url;
        },
        error:function(XMLHttpRequest, textStatus, errorThrown){
            //access-token刷新失败（可能refresh-token过期或者账号密码改了），重定向到登录页面
            location.href = login_url;
        }
    });
    </script>
    </body>
    </html>
    ```
    
2.  ajax 调用时，封装一下 jquery 的 ajax：
    
    ```
    yjClient.ajax=function(options){
        var data=options.data;
    	var url=options.url;
     
    	function callAjax(){
        	$.ajax({
        		cache:options.cache?options.cache:false,
        		method:options.method?options.method:(options.type?options.type:'get'),
        		async:(options.async==undefined)?true:options.async,
        		url:url,
            	data:data,
            	success:function(data, textStatus){
        			if (options.success){
        				options.success(data);
        			}				
        		},
        		error:function(XMLHttpRequest, textStatus, errorThrown){
        		    if (XMLHttpRequest.responseText){
        		        var msg=XMLHttpRequest.responseText;
        		        var err=JSON.parse(XMLHttpRequest.responseText);
        		    }
        		    else{
        		        var msg=yjClient.getAjaxErrorMsg(XMLHttpRequest,textStatus,errorThrown);
        		        var err=new Error(msg);
        		    }
        		    if (err.code=="tm.err.foil.accessTokenExpired"){
        		        console.log('refresh token...');
        		        var refresh_Token=refresh_token=localStorage.getItem(yjClient.cookieIDs.refreshToken);
        		        $.ajax({
        		            cache:false,
        		            method:"get",
        		            async:true,
        		            url:'/app/account/refreshToken',
        		            data:{
        		                refresh_token:refresh_token
        		            },
        		            success:function(data, textStatus){
        		                callAjax();
        		            },
        		            error:function(XMLHttpRequest, textStatus, errorThrown){
        		                //access-token刷新失败（可能refresh-token过期或者账号密码改了），重定向到登录页面
        		                yjClient.redirectToLoginPage();
        		            }
        		        });
        		        return;
    				}
    				if (err.code=="tm.err.foil.tokenNotProvided"){
    					yjClient.redirectToLoginPage();
    					return;
    				}
        			if (options.error){
        				options.error(err);
        			}
        			else{
        				yjClient.showDialog(yjDD["Failed!"],msg);
        			}
        		}
        	});
        }
    	callAjax();
    }
    ```